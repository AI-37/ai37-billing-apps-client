import { readFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()

const packageJsonPath = path.join(root, 'package.json')
const versionFilePath = path.join(root, 'VERSION')
const changelogPath = path.join(root, 'CHANGELOG.md')

const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'))
const packageVersion = String(packageJson.version ?? '').trim()
const versionFile = (await readFile(versionFilePath, 'utf8')).trim()
const changelog = await readFile(changelogPath, 'utf8')

if (!packageVersion) {
  throw new Error('package.json version is empty')
}

if (!versionFile) {
  throw new Error('VERSION file is empty')
}

if (packageVersion !== versionFile) {
  throw new Error(
    `VERSION mismatch: package.json=${packageVersion}, VERSION=${versionFile}`,
  )
}

const escapedVersion = packageVersion.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const sectionPattern = new RegExp(
  `^##\\s+\\[?${escapedVersion}\\]?(?:\\s+-\\s+.+)?\\s*\\n([\\s\\S]*?)(?=^##\\s+|$)`,
  'm',
)
const sectionMatch = changelog.match(sectionPattern)

if (!sectionMatch) {
  throw new Error(
    `CHANGELOG.md does not contain a release section for version ${packageVersion}`,
  )
}

const changelogBody = sectionMatch[1]
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean)

if (changelogBody.length === 0) {
  throw new Error(
    `CHANGELOG.md section for version ${packageVersion} is empty`,
  )
}

console.log(`Release metadata validated for version ${packageVersion}`)