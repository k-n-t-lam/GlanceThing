import {
  app,
  shell,
  BrowserWindow,
  ipcMain,
  Tray,
  Menu,
  Notification,
  protocol,
  net,
} from 'electron';
import { electronApp, optimizer, is } from '@electron-toolkit/utils';
import { join } from 'path';

import {
  getStorageValue,
  setSpotifyDc,
  setStorageValue,
} from './lib/storage.js';
import { isDev, log } from './lib/utils.js';
import {
  startServer,
  stopServer,
  isServerStarted,
  updateApps,
} from './lib/server.js';
import {
  findCarThing,
  installApp,
  checkInstalledApp,
  forwardSocketServer,
  getAdbExecutable,
} from './lib/adb.js';
import {
  getShortcuts,
  addShortcut,
  removeShortcut,
  updateShortcut,
  uploadShortcutImage,
  getShortcutImagePath,
  removeShortcutImage,
} from './lib/shortcuts.js';

import icon from '../../resources/icon.png?asset';
import trayIcon from '../../resources/tray.png?asset';
import { getToken } from './lib/spotify.js';

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
    },
    titleBarStyle: 'hidden',
    resizable: false,
    maximizable: false,
    minimizable: false,
  });

  mainWindow.on('ready-to-show', async () => {
    mainWindow!.show();
    mainWindow!.center();
  });

  mainWindow.on('closed', async () => {
    const firstClose = await getStorageValue('firstClose');

    if (firstClose !== false) {
      await setStorageValue('firstClose', false);

      new Notification({
        title: 'Still Running!',
        body: 'GlanceThing has been minimized to the system tray, and is still running in the background!',
      }).show();
    }

    mainWindow = null;
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: 'deny' };
  });

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

app.on('ready', async () => {
  if (
    process.env.NODE_ENV === 'development' &&
    (await getStorageValue('devMode')) === null
  ) {
    await setStorageValue('devMode', true);
  }

  log('Welcome!', 'GlanceThing');
  if (await isDev()) log('Running in development mode', 'GlanceThing');
  electronApp.setAppUserModelId('com.bludood.glancething');

  const adbPath = await getAdbExecutable().catch((err) => ({ err }));

  console.log('adbPath', adbPath);

  if (typeof adbPath === 'object' && adbPath.err) {
    log(`Failed to get ADB executable: ${adbPath.err.message}`, 'adb');
  } else {
    if (adbPath === 'adb') log('Using system adb', 'adb');
    else log(`Using downloaded ADB from path: ${adbPath}`, 'adb');
  }

  if ((await getStorageValue('setupComplete')) === true) await startServer();

  await setupIpcHandlers();
  await setupTray();

  protocol.handle('shortcut', (req) => {
    const name = req.url.split('/').pop();
    if (!name) return new Response(null, { status: 404 });
    const path = getShortcutImagePath(name.split('?')[0]);
    if (!path) return new Response(null, { status: 404 });
    return net.fetch(`file://${path}`);
  });

  if ((await getStorageValue('launchMinimized')) !== true) createWindow();
});

app.on('browser-window-created', (_, window) => {
  optimizer.watchWindowShortcuts(window);
});

app.on('window-all-closed', () => {
  // don't quit the process
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

enum IPCHandler {
  FindCarThing = 'findCarThing',
  FindSetupCarThing = 'findSetupCarThing',
  InstallApp = 'installApp',
  StartServer = 'startServer',
  StopServer = 'stopServer',
  IsServerStarted = 'isServerStarted',
  ForwardSocketServer = 'forwardSocketServer',
  GetVersion = 'getVersion',
  GetStorageValue = 'getStorageValue',
  SetStorageValue = 'setStorageValue',
  TriggerCarThingStateUpdate = 'triggerCarThingStateUpdate',
  UploadShortcutImage = 'uploadShortcutImage',
  RemoveNewShortcutImage = 'removeNewShortcutImage',
  GetShortcuts = 'getShortcuts',
  AddShortcut = 'addShortcut',
  RemoveShortcut = 'removeShortcut',
  UpdateShortcut = 'updateShortcut',
  IsDevMode = 'isDevMode',
  SetSpotifyToken = 'setSpotifyToken',
}

async function setupIpcHandlers() {
  ipcMain.handle(IPCHandler.FindCarThing, async () => {
    const found = await findCarThing().catch((err) => ({ err }));
    if (typeof found !== 'string' && found?.err) return found.err.message;
    return !!found;
  });

  ipcMain.handle(IPCHandler.FindSetupCarThing, async () => {
    const found = await findCarThing();
    if (!found) return 'not_found';

    const installed = await checkInstalledApp(found);
    if (!installed) return 'not_installed';

    return 'ready';
  });

  ipcMain.handle(IPCHandler.InstallApp, async () => {
    const res = await installApp(null).catch((err) => ({ err }));
    if (res?.err) return res.err.message;
    return true;
  });

  ipcMain.handle(IPCHandler.StartServer, async () => {
    await startServer();
  });

  ipcMain.handle(IPCHandler.StopServer, async () => {
    await stopServer();
  });

  ipcMain.handle(IPCHandler.IsServerStarted, async () => {
    return await isServerStarted();
  });

  ipcMain.handle(IPCHandler.ForwardSocketServer, async () => {
    await forwardSocketServer(null);
  });

  ipcMain.handle(IPCHandler.GetVersion, () => {
    return app.getVersion();
  });

  ipcMain.handle(IPCHandler.GetStorageValue, async (_event, key) => {
    return await getStorageValue(key);
  });

  ipcMain.handle(IPCHandler.SetStorageValue, async (_event, key, value) => {
    return await setStorageValue(key, value);
  });

  async function carThingStateUpdate() {
    const found = await findCarThing().catch((err) => {
      log(
        `Got an error while finding CarThing: ${err.message}`,
        'CarThingState'
      );
      return null;
    });

    if (found) {
      const installed = await checkInstalledApp(found);

      if (installed) {
        mainWindow?.webContents.send('carThingState', 'ready');
        await forwardSocketServer(found);
      } else {
        const willAutoInstall = await getStorageValue('installAutomatically');
        if (willAutoInstall) {
          mainWindow?.webContents.send('carThingState', 'installing');
          await installApp(found);
        } else {
          mainWindow?.webContents.send('carThingState', 'not_installed');
        }
      }
    } else {
      mainWindow?.webContents.send('carThingState', 'not_found');
    }
  }

  async function interval() {
    await carThingStateUpdate();

    setTimeout(interval, 5000);
  }

  interval();

  ipcMain.handle(IPCHandler.TriggerCarThingStateUpdate, async () => {
    await carThingStateUpdate();
  });

  ipcMain.handle(IPCHandler.UploadShortcutImage, async (_event, name) => {
    return await uploadShortcutImage(name);
  });

  ipcMain.handle(IPCHandler.RemoveNewShortcutImage, async () => {
    return removeShortcutImage('new');
  });

  ipcMain.handle(IPCHandler.GetShortcuts, async () => {
    return await getShortcuts();
  });

  ipcMain.handle(IPCHandler.AddShortcut, async (_event, shortcut) => {
    await addShortcut(shortcut);
    await updateApps();
  });

  ipcMain.handle(IPCHandler.RemoveShortcut, async (_event, shortcut) => {
    await removeShortcut(shortcut);
    await updateApps();
  });

  ipcMain.handle(IPCHandler.UpdateShortcut, async (_event, shortcut) => {
    await updateShortcut(shortcut);
    await updateApps();
  });

  ipcMain.handle(IPCHandler.IsDevMode, async () => {
    return await isDev();
  });

  ipcMain.handle(IPCHandler.SetSpotifyToken, async (_event, token) => {
    const accessToken = await getToken(token).catch(() => null);

    if (accessToken) {
      await setSpotifyDc(token);
      return true;
    } else {
      return false;
    }
  });
}

async function setupTray() {
  const tray = new Tray(trayIcon);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: `GlanceThing v${app.getVersion()}`,
      enabled: false,
    },
    {
      type: 'separator',
    },
    {
      label: 'Show',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
        } else {
          createWindow();
        }
      },
    },
    {
      label: 'Quit',
      click: () => {
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  tray.setToolTip(`GlanceThing v${app.getVersion()}`);

  tray.on('click', () => {
    if (mainWindow) {
      mainWindow.show();
    } else {
      createWindow();
    }
  });
}
