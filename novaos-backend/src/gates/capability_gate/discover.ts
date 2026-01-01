// ═══════════════════════════════════════════════════════════════════════════════
// CAPABILITY GATE — Discovery
// Auto-discovers *.capability.ts files and prompts for metadata
// ═══════════════════════════════════════════════════════════════════════════════

import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath, pathToFileURL } from 'url';
import type { Capability, CapabilityMeta, EvidenceItem } from './types.js';
import { getCapabilityRegistry } from './registry.js';

// ─────────────────────────────────────────────────────────────────────────────────
// PATHS
// ─────────────────────────────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REGISTRY_FILE = path.join(__dirname, 'capability-registry.json');
const CAPABILITIES_DIR = path.join(__dirname, 'capabilities');

// ─────────────────────────────────────────────────────────────────────────────────
// REGISTRY FILE OPERATIONS
// ─────────────────────────────────────────────────────────────────────────────────

function loadRegistryFile(): Record<string, CapabilityMeta> {
  try {
    if (fs.existsSync(REGISTRY_FILE)) {
      const content = fs.readFileSync(REGISTRY_FILE, 'utf-8');
      return JSON.parse(content);
    }
  } catch (error) {
    console.warn('[CAPABILITY] Failed to load registry file:', error);
  }
  return {};
}

function saveRegistryFile(registry: Record<string, CapabilityMeta>): void {
  try {
    fs.writeFileSync(REGISTRY_FILE, JSON.stringify(registry, null, 2));
  } catch (error) {
    console.error('[CAPABILITY] Failed to save registry file:', error);
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// CLI PROMPT
// ─────────────────────────────────────────────────────────────────────────────────

async function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────────
// DISCOVER NEW CAPABILITIES (with prompts)
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Discover new capability files and prompt for metadata.
 * Call this during development/setup.
 */
export async function discoverNewCapabilities(): Promise<void> {
  const registryData = loadRegistryFile();
  
  if (!fs.existsSync(CAPABILITIES_DIR)) {
    console.warn('[CAPABILITY] Capabilities directory not found:', CAPABILITIES_DIR);
    return;
  }

  const files = fs.readdirSync(CAPABILITIES_DIR);
  let hasChanges = false;

  for (const file of files) {
    // Only process *.capability.ts or *.capability.js
    if (!file.match(/\.capability\.(ts|js)$/)) {
      continue;
    }

    const key = file.replace(/\.(ts|js)$/, '');

    // Already registered?
    if (registryData[key]) {
      continue;
    }

    // New capability detected - prompt for metadata
    console.log(`\n[CAPABILITY] New capability detected: ${file}`);
    
    const name = await prompt('  Enter name (e.g., my_new_fetcher): ');
    if (!name) {
      console.log('  Skipped (no name provided)');
      continue;
    }

    const description = await prompt('  Enter description: ');
    if (!description) {
      console.log('  Skipped (no description provided)');
      continue;
    }

    const evidenceType = await prompt('  Enter evidence type (e.g., my_type): ');
    if (!evidenceType) {
      console.log('  Skipped (no evidence type provided)');
      continue;
    }

    registryData[key] = { name, description, evidenceType };
    hasChanges = true;

    console.log(`[CAPABILITY] ✓ Registered: ${name}`);
  }

  if (hasChanges) {
    saveRegistryFile(registryData);
    console.log(`[CAPABILITY] Registry saved`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// LOAD AND REGISTER ALL CAPABILITIES
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Load all capabilities from registry file and register them.
 * Call this at application startup.
 */
export async function loadAndRegisterCapabilities(): Promise<void> {
  const registryData = loadRegistryFile();
  const registry = getCapabilityRegistry();

  if (Object.keys(registryData).length === 0) {
    console.log('[CAPABILITY] No capabilities registered');
    return;
  }

  for (const [key, meta] of Object.entries(registryData)) {
    // Try .js first (compiled), then .ts
    let filePath = path.join(CAPABILITIES_DIR, `${key}.js`);
    if (!fs.existsSync(filePath)) {
      filePath = path.join(CAPABILITIES_DIR, `${key}.ts`);
    }

    if (!fs.existsSync(filePath)) {
      console.warn(`[CAPABILITY] File not found: ${key}`);
      continue;
    }

    try {
      // Convert Windows path to file:// URL for ESM import
      const fileUrl = pathToFileURL(filePath).href;
      const module = await import(fileUrl);

      if (typeof module.execute !== 'function') {
        console.warn(`[CAPABILITY] ${key} missing execute function`);
        continue;
      }

      // Create capability with metadata from registry
      const capability: Capability = {
        name: meta.name,
        description: meta.description,
        evidenceType: meta.evidenceType,
        execute: async (userMessage: string): Promise<EvidenceItem | null> => {
          const result = await module.execute(userMessage);
          if (result === null) return null;
          
          // If execute returns a string, wrap it
          if (typeof result === 'string') {
            return {
              type: meta.evidenceType,
              formatted: result,
              source: meta.name,
              fetchedAt: Date.now(),
            };
          }
          
          // If execute returns EvidenceItem, use it
          return result;
        },
      };

      registry.register(capability);

    } catch (error) {
      console.error(`[CAPABILITY] Failed to load ${key}:`, error);
    }
  }

  const names = registry.getNames();
  if (names.length > 0) {
    console.log(`[CAPABILITY] Loaded: ${names.join(', ')}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// INITIALIZE (for production - no prompts)
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Initialize capabilities without interactive prompts.
 * Use this for production startup.
 */
export async function initializeCapabilities(): Promise<void> {
  await loadAndRegisterCapabilities();
}

// ─────────────────────────────────────────────────────────────────────────────────
// SETUP (for development - with prompts)
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Setup capabilities with interactive prompts for new ones.
 * Use this during development.
 */
export async function setupCapabilities(): Promise<void> {
  await discoverNewCapabilities();
  await loadAndRegisterCapabilities();
}

// ─────────────────────────────────────────────────────────────────────────────────
// ADD CAPABILITY PROGRAMMATICALLY
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Add a capability to the registry file programmatically.
 */
export function addCapabilityToRegistry(
  fileKey: string,
  meta: CapabilityMeta
): void {
  const registryData = loadRegistryFile();
  registryData[fileKey] = meta;
  saveRegistryFile(registryData);
}

/**
 * Remove a capability from the registry file.
 */
export function removeCapabilityFromRegistry(fileKey: string): boolean {
  const registryData = loadRegistryFile();
  if (registryData[fileKey]) {
    delete registryData[fileKey];
    saveRegistryFile(registryData);
    return true;
  }
  return false;
}

/**
 * List all capabilities in registry file.
 */
export function listRegisteredCapabilities(): CapabilityMeta[] {
  const registryData = loadRegistryFile();
  return Object.values(registryData);
}
