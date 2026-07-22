import { execSync } from 'node:child_process'
import { cpSync, mkdirSync, readFileSync, rmSync } from 'node:fs'

const { version } = JSON.parse(readFileSync('manifest.json', 'utf8'))
const name = `kotiq-translate-${version}`

mkdirSync('builds', { recursive: true })
rmSync(`builds/${name}`, { recursive: true, force: true })
rmSync(`builds/${name}.zip`, { force: true })

cpSync('dist', `builds/${name}`, { recursive: true })
// The store expects manifest.json at the zip root, so zip the folder's contents.
execSync(`zip -qr ../${name}.zip . -x "*.DS_Store"`, { cwd: `builds/${name}` })

console.log(`builds/${name}.zip`)
