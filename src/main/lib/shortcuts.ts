import { app, dialog } from 'electron'
import path from 'path'
import fs from 'fs'

import { getStorageValue, setStorageValue } from './storage.js'

interface Shortcut {
  id: string
  command: string
}

export async function uploadShortcutImage(name: string) {
  const res = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'PNG Image', extensions: ['png'] }]
  })

  if (res.canceled) return false

  const imagePath = res.filePaths[0]

  const userData = app.getPath('userData')
  const imageFolder = path.join(userData, 'shortcuts')
  const target = path.join(imageFolder, `${name}.png`)

  if (!fs.existsSync(`${userData}/shortcuts`))
    fs.mkdirSync(`${userData}/shortcuts`)

  fs.copyFileSync(imagePath, target)

  return true
}

export function getShortcutImagePath(id: string) {
  const userData = app.getPath('userData')
  const imageFolder = path.join(userData, 'shortcuts')
  const target = path.join(imageFolder, `${id}.png`)

  if (!fs.existsSync(target)) return null

  return target
}

export function getShortcutImage(id: string) {
  const imagePath = getShortcutImagePath(id)

  if (!imagePath) return null

  return fs.readFileSync(imagePath)
}

function saveShortcutImage(id: string) {
  const userData = app.getPath('userData')
  const imageFolder = path.join(userData, 'shortcuts')
  const newImage = path.join(imageFolder, 'new.png')

  fs.copyFileSync(newImage, path.join(imageFolder, `${id}.png`))

  fs.rmSync(newImage)
}

export function removeShortcutImage(id: string) {
  const imagePath = getShortcutImagePath(id)

  if (!imagePath) return

  fs.rmSync(imagePath)
}

export async function getShortcuts() {
  const shortcuts = await getStorageValue('shortcuts')

  if (!shortcuts) return []

  return shortcuts as Shortcut[]
}

export async function addShortcut(shortcut: Shortcut) {
  const shortcuts = await getShortcuts()

  shortcuts.push(shortcut)

  await setStorageValue('shortcuts', shortcuts)

  saveShortcutImage(shortcut.id)
}

export async function removeShortcut(id: string) {
  const shortcuts = await getShortcuts()
  const index = shortcuts.findIndex(s => s.id === id)

  if (index === -1) return

  shortcuts.splice(index, 1)

  await setStorageValue('shortcuts', shortcuts)

  removeShortcutImage(id)
}

export async function updateShortcut(shortcut: Shortcut) {
  const shortcuts = await getShortcuts()
  const index = shortcuts.findIndex(s => s.id === shortcut.id)

  if (index === -1) return

  shortcuts[index] = shortcut

  await setStorageValue('shortcuts', shortcuts)
}
