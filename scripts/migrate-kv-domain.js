const { execSync } = require('child_process');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

const argv = yargs(hideBin(process.argv))
  .option('old-domain', {
    alias: 'o',
    type: 'string',
    description: 'The old domain to search for',
    default: 'sillylittle.tech'
  })
  .option('new-domain', {
    alias: 'n',
    type: 'string',
    description: 'The new domain to replace with',
    default: 'slt.ong'
  })
  .option('remote', {
    type: 'boolean',
    description: 'Use the --remote flag to interact with remote storage',
    default: false
  })
  .help()
  .alias('help', 'h')
  .argv;

const OLD_DOMAIN = argv['old-domain'];
const NEW_DOMAIN = argv['new-domain'];
const REMOTE_FLAG = argv.remote ? '--remote' : '';

function runWranglerCommand(command) {
  try {
    return execSync(command, { encoding: 'utf-8' });
  } catch (error) {
    console.error(`Error executing command: ${command}`);
    console.error(error.message);
    process.exit(1);
  }
}

async function migrateKV() {
  console.log(`Starting KV migration from ${OLD_DOMAIN} to ${NEW_DOMAIN}...`);

  // List all keys
  console.log('Fetching KV keys...');
  const command = `npx wrangler kv key list --binding=LINKIVERSE ${REMOTE_FLAG}`;
  console.log(`Running: ${command}`);
  const keysOutput = runWranglerCommand(command);

  let keys;
  try {
    keys = JSON.parse(keysOutput);
  } catch (e) {
    console.error('Failed to parse KV keys JSON:', e);
    process.exit(1);
  }

  // Filter for keys with the old domain
  const oldKeys = keys.filter(k => k.name.includes(OLD_DOMAIN));

  if (oldKeys.length === 0) {
    console.log(`No keys found containing '${OLD_DOMAIN}'. Migration complete.`);
    return;
  }

  console.log(`Found ${oldKeys.length} keys to migrate.`);

  for (const keyObj of oldKeys) {
    const oldKey = keyObj.name;
    const newKey = oldKey.replace(new RegExp(OLD_DOMAIN, 'g'), NEW_DOMAIN);

    console.log(`Migrating key: ${oldKey} -> ${newKey}`);

    // Get old value
    console.log(`  Fetching value for ${oldKey}...`);
    const oldValueCommand = `npx wrangler kv key get "${oldKey}" --binding=LINKIVERSE ${REMOTE_FLAG}`;
    let oldValue = runWranglerCommand(oldValueCommand);
    // Wrangler sometimes adds a newline at the end of output, we might want to preserve it or let it be

    // Replace domain in the value as well
    const newValue = oldValue.replace(new RegExp(OLD_DOMAIN, 'g'), NEW_DOMAIN);

    // Set new key
    console.log(`  Setting new key ${newKey}...`);
    // Escape quotes if it's JSON by replacing ' with '\''
    const escapedValue = newValue.replace(/'/g, "'\\''");
    runWranglerCommand(`npx wrangler kv key put "${newKey}" '${escapedValue}' --binding=LINKIVERSE ${REMOTE_FLAG}`);

    // Delete old key
    console.log(`  Deleting old key ${oldKey}...`);
    runWranglerCommand(`npx wrangler kv key delete "${oldKey}" --binding=LINKIVERSE ${REMOTE_FLAG}`);

    console.log(`  Done with ${oldKey}.`);
  }

  console.log('Migration completed successfully!');
}

migrateKV();
