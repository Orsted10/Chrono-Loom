import * as THREE from 'three';
import { LoomEngine } from './LoomEngine.js';
import { SpatialSynth } from './SpatialSynth.js';
import { EuclideanEngine } from './EuclideanEngine.js';

export interface VaultSculpture {
  id: string;
  name: string;
  timestamp: number;
  formattedDate: string;
  nodeCount: number;
  stringCount: number;
  bpm: number;
  scaleName: string;
  thumbnailSvg: string;
  snapshot: {
    nodes: { id: string; x: number; y: number; z: number; freq: number }[];
    strings: { id: string; nodeA: string; nodeB: string }[];
    bpm: number;
  };
}

export class HarmonicVault {
  private loomEngine: LoomEngine;
  private spatialSynth: SpatialSynth;
  private euclideanEngine: EuclideanEngine;

  public readonly STORAGE_KEY = 'chronoloom_vault_v1';
  public readonly MAX_SLOTS = 8;
  public readonly MAX_RECORD_SECONDS = 15.0;

  // Recording State
  public isRecording = false;
  public recordElapsed = 0;
  private pcmChunksLeft: Float32Array[] = [];
  private pcmChunksRight: Float32Array[] = [];
  private audioTap: { processor: ScriptProcessorNode; disconnect: () => void } | null = null;
  private recordSampleRate = 44100;

  // DOM UI Elements
  private modalContainer: HTMLElement | null = null;
  public isModalOpen = false;

  constructor(
    loomEngine: LoomEngine,
    spatialSynth: SpatialSynth,
    euclideanEngine: EuclideanEngine
  ) {
    this.loomEngine = loomEngine;
    this.spatialSynth = spatialSynth;
    this.euclideanEngine = euclideanEngine;

    this.createVaultModalUI();
  }

  // ----------------------------------------------------
  // 1. Storage & Gallery Management (Up to 8 Slots)
  // ----------------------------------------------------

  public getSavedSculptures(): VaultSculpture[] {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (!raw) return [];
      return JSON.parse(raw);
    } catch (e) {
      console.warn('[HarmonicVault] Failed to parse vault sculptures from localStorage:', e);
      return [];
    }
  }

  private saveVaultList(items: VaultSculpture[]): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(items.slice(0, this.MAX_SLOTS)));
    } catch (e) {
      console.warn('[HarmonicVault] Failed to save vault sculptures to localStorage:', e);
    }
  }

  /**
   * Saves the current 3D musical sculpture into the next vault slot
   */
  public saveCurrentSculpture(customName?: string): VaultSculpture {
    const snapshot = this.loomEngine.getLoomSnapshot();
    const list = this.getSavedSculptures();

    const scaleName = this.euclideanEngine?.activeScale?.name || 'Celestial Lydian';
    const now = new Date();
    const dateStr = now.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    const slotNum = list.length + 1;
    const name = customName || `Sculpture #${slotNum} // ${scaleName}`;

    // Generate Miniature 2D SVG Thumbnail
    const thumbnailSvg = this.generateConstellationSvg(snapshot.nodes, snapshot.strings);

    const item: VaultSculpture = {
      id: `sculpture_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name,
      timestamp: Date.now(),
      formattedDate: dateStr,
      nodeCount: snapshot.nodes.length,
      stringCount: snapshot.strings.length,
      bpm: snapshot.bpm || this.loomEngine.globalBPM,
      scaleName,
      thumbnailSvg,
      snapshot
    };

    // Prepend new item (max 8)
    const updated = [item, ...list].slice(0, this.MAX_SLOTS);
    this.saveVaultList(updated);

    this.renderVaultGrid();
    console.log(`[HarmonicVault] Saved "${name}" (${item.nodeCount} nodes, ${item.stringCount} strings) to slot 1.`);
    return item;
  }

  /**
   * Restores a saved sculpture into the Loom
   */
  public loadSculpture(id: string): boolean {
    const list = this.getSavedSculptures();
    const item = list.find((s) => s.id === id);
    if (!item) return false;

    // Clear existing nodes and strings
    this.loomEngine.resetLoom();

    // Reconstruct sculpture from snapshot
    this.loomEngine.applyLoomSnapshot(item.snapshot);

    console.log(`[HarmonicVault] Loaded "${item.name}" from Vault into Loom.`);
    return true;
  }

  /**
   * Deletes a sculpture from the gallery
   */
  public deleteSculpture(id: string): void {
    const list = this.getSavedSculptures();
    const filtered = list.filter((s) => s.id !== id);
    this.saveVaultList(filtered);
    this.renderVaultGrid();
  }

  /**
   * Exports the sculpture as a downloadable .json file
   */
  public exportSculptureJson(id: string): void {
    const list = this.getSavedSculptures();
    const item = list.find((s) => s.id === id);
    if (!item) return;

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(item, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute('href', dataStr);
    dlAnchor.setAttribute('download', `chronoloom-${item.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}.json`);
    document.body.appendChild(dlAnchor);
    dlAnchor.click();
    dlAnchor.remove();
  }

  // ----------------------------------------------------
  // 2. Miniature 2D Constellation SVG Generator
  // ----------------------------------------------------

  /**
   * Auto-generates a crisp miniature 2D SVG thumbnail of the active constellation sculpture
   */
  public generateConstellationSvg(
    nodes: { id: string; x: number; y: number; z: number; freq: number }[],
    strings: { id: string; nodeA: string; nodeB: string }[]
  ): string {
    const width = 160;
    const height = 100;

    if (!nodes || nodes.length === 0) {
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
        <rect width="${width}" height="${height}" rx="10" fill="#07182d" stroke="#00f0ff" stroke-width="1.5" stroke-opacity="0.3"/>
        <text x="50%" y="54%" text-anchor="middle" fill="#64748b" font-family="'JetBrains Mono', monospace" font-size="11">EMPTY SCULPTURE</text>
      </svg>`;
    }

    // Determine 2D bounds (X and Y coordinates)
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    nodes.forEach((n) => {
      if (n.x < minX) minX = n.x;
      if (n.x > maxX) maxX = n.x;
      if (n.y < minY) minY = n.y;
      if (n.y > maxY) maxY = n.y;
    });

    const rangeX = Math.max(maxX - minX, 0.15);
    const rangeY = Math.max(maxY - minY, 0.15);
    const pad = 20;

    const mapX = (x: number) => pad + ((x - minX) / rangeX) * (width - pad * 2);
    // Invert Y so higher spatial Y renders higher in 2D SVG
    const mapY = (y: number) => height - pad - ((y - minY) / rangeY) * (height - pad * 2);

    const nodeMap = new Map<string, { cx: number; cy: number; freq: number }>();
    nodes.forEach((n) => {
      nodeMap.set(n.id, { cx: mapX(n.x), cy: mapY(n.y), freq: n.freq });
    });

    // Generate Strings as Glowing Neon SVG Lines
    let linesSvg = '';
    strings.forEach((s) => {
      const a = nodeMap.get(s.nodeA);
      const b = nodeMap.get(s.nodeB);
      if (a && b) {
        linesSvg += `<line x1="${a.cx.toFixed(1)}" y1="${a.cy.toFixed(1)}" x2="${b.cx.toFixed(1)}" y2="${b.cy.toFixed(1)}" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" opacity="0.85" filter="drop-shadow(0 0 3px #00f0ff)"/>`;
      }
    });

    // Generate Nodes as Concentric Luminous Dots
    let nodesSvg = '';
    nodeMap.forEach((pt) => {
      nodesSvg += `
        <circle cx="${pt.cx.toFixed(1)}" cy="${pt.cy.toFixed(1)}" r="6" fill="#fbbf24" fill-opacity="0.35"/>
        <circle cx="${pt.cx.toFixed(1)}" cy="${pt.cy.toFixed(1)}" r="3.5" fill="#f59e0b" stroke="#ffffff" stroke-width="1.2"/>
      `;
    });

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
      <defs>
        <linearGradient id="vaultBg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#040d1a"/>
          <stop offset="100%" stop-color="#0b1b33"/>
        </linearGradient>
      </defs>
      <rect width="${width}" height="${height}" rx="10" fill="url(#vaultBg)" stroke="#00f0ff" stroke-width="1.5" stroke-opacity="0.5"/>
      ${linesSvg}
      ${nodesSvg}
    </svg>`;
  }

  // ----------------------------------------------------
  // 3. Lossless 15-Second Stereo Audio-Loop Recorder (.wav)
  // ----------------------------------------------------

  /**
   * Starts live 15-second lossless stereo recording from the spatial synthesizer master bus
   */
  public startAudioRecording(): boolean {
    if (this.isRecording) return false;

    const tap = this.spatialSynth.createAudioProcessorTap(4096);
    if (!tap) {
      console.warn('[HarmonicVault] AudioContext not ready for recording.');
      return false;
    }

    this.audioTap = tap;
    this.isRecording = true;
    this.recordElapsed = 0;
    this.pcmChunksLeft = [];
    this.pcmChunksRight = [];
    this.recordSampleRate = this.spatialSynth.audioCtx?.sampleRate || 44100;

    tap.processor.onaudioprocess = (e) => {
      if (!this.isRecording) return;
      const left = e.inputBuffer.getChannelData(0);
      const right = e.inputBuffer.getChannelData(1);
      this.pcmChunksLeft.push(new Float32Array(left));
      this.pcmChunksRight.push(new Float32Array(right));
    };

    console.log(`[HarmonicVault] 🔴 Started 15s Stereo Audio Recording @ ${this.recordSampleRate}Hz.`);
    this.updateRecordingUI();
    return true;
  }

  /**
   * Stops recording and optionally downloads lossless .wav loop + .json snapshot
   */
  public stopAudioRecording(triggerDownload: boolean = true): void {
    if (!this.isRecording) return;

    this.isRecording = false;
    if (this.audioTap) {
      this.audioTap.disconnect();
      this.audioTap = null;
    }

    console.log(`[HarmonicVault] ⏹️ Stopped recording (${this.recordElapsed.toFixed(1)}s captured). Encoding lossless WAV...`);

    // Concatenate PCM Chunks
    const totalSamples = this.pcmChunksLeft.reduce((acc, c) => acc + c.length, 0);
    const leftFull = new Float32Array(totalSamples);
    const rightFull = new Float32Array(totalSamples);

    let offset = 0;
    for (let i = 0; i < this.pcmChunksLeft.length; i++) {
      leftFull.set(this.pcmChunksLeft[i], offset);
      rightFull.set(this.pcmChunksRight[i], offset);
      offset += this.pcmChunksLeft[i].length;
    }

    if (triggerDownload && totalSamples > 0) {
      // Encode standard 16-bit stereo PCM WAV
      const wavBlob = this.encodeWAV(leftFull, rightFull, this.recordSampleRate);
      const timestamp = Date.now();

      // Trigger .wav download
      const wavUrl = URL.createObjectURL(wavBlob);
      const dlAnchor = document.createElement('a');
      dlAnchor.href = wavUrl;
      dlAnchor.download = `chronoloom-loop-${timestamp}.wav`;
      document.body.appendChild(dlAnchor);
      dlAnchor.click();
      dlAnchor.remove();
      setTimeout(() => URL.revokeObjectURL(wavUrl), 10000);

      // Save sculpture snapshot to vault automatically
      const saved = this.saveCurrentSculpture(`Loop Recording @ ${new Date().toLocaleTimeString()}`);

      // Trigger companion .json download
      this.exportSculptureJson(saved.id);
    }

    this.updateRecordingUI();
  }

  /**
   * Pure procedural 16-bit Stereo PCM WAV Encoder
   */
  private encodeWAV(left: Float32Array, right: Float32Array, sampleRate: number): Blob {
    const numChannels = 2;
    const bitsPerSample = 16;
    const bytesPerSample = bitsPerSample / 8;
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const numSamples = Math.min(left.length, right.length);
    const dataSize = numSamples * blockAlign;
    const bufferSize = 44 + dataSize;

    const buffer = new ArrayBuffer(bufferSize);
    const view = new DataView(buffer);

    // RIFF Chunk Descriptor
    this.writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true); // ChunkSize
    this.writeString(view, 8, 'WAVE');

    // fmt Sub-chunk
    this.writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);             // Subchunk1Size (16 for PCM)
    view.setUint16(20, 1, true);              // AudioFormat (1 for PCM)
    view.setUint16(22, numChannels, true);    // NumChannels (2)
    view.setUint32(24, sampleRate, true);     // SampleRate
    view.setUint32(28, byteRate, true);       // ByteRate
    view.setUint16(32, blockAlign, true);     // BlockAlign
    view.setUint16(34, bitsPerSample, true);  // BitsPerSample (16)

    // data Sub-chunk
    this.writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);

    // Interleave Left & Right 16-bit PCM Samples
    let index = 44;
    for (let i = 0; i < numSamples; i++) {
      // Clamp float samples to [-1.0, 1.0] and convert to 16-bit signed integer
      const l = Math.max(-1, Math.min(1, left[i]));
      const r = Math.max(-1, Math.min(1, right[i]));

      const sL = l < 0 ? l * 0x8000 : l * 0x7fff;
      const sR = r < 0 ? r * 0x8000 : r * 0x7fff;

      view.setInt16(index, sL, true);
      view.setInt16(index + 2, sR, true);
      index += 4;
    }

    return new Blob([view], { type: 'audio/wav' });
  }

  private writeString(view: DataView, offset: number, string: string): void {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  // ----------------------------------------------------
  // 4. Per-Frame Update (Recording Timer)
  // ----------------------------------------------------

  public update(deltaTime: number): void {
    if (this.isRecording) {
      this.recordElapsed += deltaTime;
      this.updateRecordingUI();

      if (this.recordElapsed >= this.MAX_RECORD_SECONDS) {
        this.stopAudioRecording();
      }
    }
  }

  // ----------------------------------------------------
  // 5. DOM UI & Modal Construction
  // ----------------------------------------------------

  private createVaultModalUI(): void {
    this.modalContainer = document.createElement('div');
    this.modalContainer.id = 'harmonic-vault-modal';
    this.modalContainer.className = 'vault-modal-overlay';
    this.modalContainer.style.display = 'none';

    this.modalContainer.innerHTML = `
      <div class="vault-modal-card">
        <div class="vault-modal-header">
          <div class="vault-header-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00f0ff" stroke-width="2">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
            </svg>
            <span>HARMONIC VAULT // LOCAL SCULPTURE GALLERY</span>
          </div>
          <button id="vault-close-btn" class="vault-close-btn">&times;</button>
        </div>

        <div class="vault-modal-actions">
          <button id="vault-save-current-btn" class="vault-action-btn vault-action-save">
            💾 Save Current Sculpture
          </button>
          <button id="vault-record-btn" class="vault-action-btn vault-action-record">
            <span class="vault-rec-dot"></span>
            <span id="vault-record-text">🔴 Rec 15s Stereo Loop (.WAV)</span>
          </button>
        </div>

        <div class="vault-grid-container" id="vault-grid">
          <!-- Rendered dynamically -->
        </div>
      </div>
    `;

    document.body.appendChild(this.modalContainer);

    // Event listeners
    document.getElementById('vault-close-btn')?.addEventListener('click', () => this.toggleModal());
    document.getElementById('vault-save-current-btn')?.addEventListener('click', () => {
      this.saveCurrentSculpture();
    });
    document.getElementById('vault-record-btn')?.addEventListener('click', () => {
      if (this.isRecording) {
        this.stopAudioRecording();
      } else {
        this.startAudioRecording();
      }
    });

    this.renderVaultGrid();
  }

  public toggleModal(): boolean {
    this.isModalOpen = !this.isModalOpen;
    if (this.modalContainer) {
      this.modalContainer.style.display = this.isModalOpen ? 'flex' : 'none';
      if (this.isModalOpen) {
        this.renderVaultGrid();
      }
    }
    return this.isModalOpen;
  }

  private updateRecordingUI(): void {
    const recText = document.getElementById('vault-record-text');
    const recBtn = document.getElementById('vault-record-btn');
    const hudRecBtn = document.getElementById('hud-record-btn');

    const progressStr = `00:${Math.floor(this.recordElapsed).toString().padStart(2, '0')} / 00:15`;

    if (recText && recBtn) {
      if (this.isRecording) {
        recText.textContent = `⏹️ STOP REC (${progressStr})`;
        recBtn.classList.add('recording-active');
      } else {
        recText.textContent = `🔴 Rec 15s Stereo Loop (.WAV)`;
        recBtn.classList.remove('recording-active');
      }
    }

    if (hudRecBtn) {
      if (this.isRecording) {
        hudRecBtn.textContent = `⏹️ REC (${progressStr})`;
        hudRecBtn.classList.add('active');
      } else {
        hudRecBtn.textContent = `🔴 Rec Loop [15s]`;
        hudRecBtn.classList.remove('active');
      }
    }
  }

  public renderVaultGrid(): void {
    const grid = document.getElementById('vault-grid');
    if (!grid) return;

    const list = this.getSavedSculptures();
    if (list.length === 0) {
      grid.innerHTML = `
        <div class="vault-empty-message">
          <p>No sculptures saved yet.</p>
          <p style="font-size: 12px; color: #64748b; margin-top: 6px;">
            Click <strong>[Save Current Sculpture]</strong> above or record a 15-second loop to save your spatial composition!
          </p>
        </div>
      `;
      return;
    }

    grid.innerHTML = list
      .map(
        (s) => `
        <div class="vault-card" data-id="${s.id}">
          <div class="vault-thumb-box">
            ${s.thumbnailSvg}
          </div>
          <div class="vault-card-body">
            <div class="vault-card-title">${s.name}</div>
            <div class="vault-card-meta">
              <span>${s.nodeCount} Nodes</span> • <span>${s.stringCount} Strings</span> • <span>${s.bpm} BPM</span>
            </div>
            <div class="vault-card-date">${s.formattedDate} // ${s.scaleName}</div>
            <div class="vault-card-actions">
              <button class="vault-btn-load" onclick="window.chronoLoomApp.harmonicVault.loadSculpture('${s.id}')">
                ⚡ Load
              </button>
              <button class="vault-btn-export" onclick="window.chronoLoomApp.harmonicVault.exportSculptureJson('${s.id}')">
                JSON
              </button>
              <button class="vault-btn-del" onclick="window.chronoLoomApp.harmonicVault.deleteSculpture('${s.id}')">
                &times;
              </button>
            </div>
          </div>
        </div>
      `
      )
      .join('');
  }
}
