import { readFileSync, writeFileSync } from 'fs'

const targetVersion = process.argv[2]
if (!targetVersion) {
  console.error('Please specify a target version')
  process.exit(1)
}

// Read minAppVersion from manifest.json
const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'))
const { minAppVersion } = manifest

// Update version in manifest.json
manifest.version = targetVersion
writeFileSync('manifest.json', JSON.stringify(manifest, null, 2))

// Update version in versions.json
let versions
try {
  versions = JSON.parse(readFileSync('versions.json', 'utf8'))
} catch (err) {
  console.error('Error parsing versions.json:', err)
  // Prefix unused variable with underscore
  versions = {}
}
versions[targetVersion] = minAppVersion
writeFileSync('versions.json', JSON.stringify(versions, null, 2))
