import { exec } from 'child_process';
import { app } from 'electron';
import crypto from 'crypto';
import moment from 'moment';
import path from 'path';
import net from 'net';
import fs from 'fs';

import { getStorageValue } from './storage.js';
import { platform } from 'os';

export const isDev = async () => (await getStorageValue('devMode')) === true;

export const random = (len: number) => crypto.randomBytes(len).toString('hex');

export async function execAsync(cmd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    exec(cmd, (error, stdout) => {
      if (error) {
        reject(error);
      } else {
        resolve(stdout);
      }
    });
  });
}

let logPath: string | null = null;

export function log(text: string, name?: string) {
  if (!logPath) logPath = path.join(app.getPath('userData'), 'glancething.log');

  const time = new Date().toLocaleTimeString([], {
    hour12: false,
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  });

  const log = `[${time}]${name ? ` <${name}>:` : ''} ${text}`;

  console.log(log);
  fs.appendFileSync(logPath, log + '\n');
}

export function safeParse(json: string) {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export async function formatDate(d = new Date()) {
  const timeFormat = (await getStorageValue('timeFormat')) || 'HH:mm';
  const dateFormat = (await getStorageValue('dateFormat')) || 'ddd, D MMM';

  const time = moment(d).format(timeFormat);
  const date = moment(d).format(dateFormat);

  return {
    time,
    date,
  };
}

export async function findOpenPort() {
  return new Promise<number>((resolve) => {
    const server = net.createServer();

    server.listen(0, () => {
      const port = (server.address() as net.AddressInfo).port;
      server.close(() => resolve(port));
    });
  });
}

export function getParsedPlatformCommand(command) {
  const os = platform();

  switch (os) {
    case 'darwin':
      return { cmd: command, shell: '/bin/sh' };

    default:
      return { cmd: `& ${command}`, shell: 'powershell.exe' };
  }
}

export function getLockedPlatformCommand() {
  const os = platform();

  switch (os) {
    case 'darwin':
      return {
        cmd: 'pmset displaysleepnow',
        shell: '/bin/sh',
      };

    default:
      return {
        cmd: 'rundll32.exe user32.dll,LockWorkStation',
        shell: 'powershell.exe',
      };
  }
}
