# GunDB Public Key Extractor and Merkle Tree Updater

This project provides utilities to extract public keys from GunDB format and update the Merkle tree in the test-env application.

## Files

- `extract-keys.js`: Extracts public keys from GunDB format and converts them to hex format
- `update-merkle-tree.js`: Updates the Merkle tree in the test-env application with the extracted keys
- `extract-keys.bat`: Windows batch file to run the extract-keys.js script
- `update-merkle-tree.bat`: Windows batch file to run the update-merkle-tree.js script

## Installation

Make sure you have Node.js installed, then install the required dependencies:

```bash
npm install keccak merkletreejs
```

## Usage

### Extract Public Keys

To extract public keys from GunDB format:

```bash
node extract-keys.js "~3JzCo5CwXFFARxwQqcvcDLUyZamResDCKv6qjTMd6bc.ILGaoRoGMfXBu4ISfTaJKfz4p_c-qxnlALCED8Gt_ds"
```

You can also provide multiple keys:

```bash
node extract-keys.js "~key1.data" "~key2.data" "~key3.data"
```

Or read keys from a file (one key per line):

```bash
node extract-keys.js --file=keys.txt
```

On Windows, you can also use the batch file:

```
extract-keys.bat "~3JzCo5CwXFFARxwQqcvcDLUyZamResDCKv6qjTMd6bc.ILGaoRoGMfXBu4ISfTaJKfz4p_c-qxnlALCED8Gt_ds"
```

### Update Merkle Tree

To update the Merkle tree in the test-env application:

```bash
node update-merkle-tree.js "~3JzCo5CwXFFARxwQqcvcDLUyZamResDCKv6qjTMd6bc.ILGaoRoGMfXBu4ISfTaJKfz4p_c-qxnlALCED8Gt_ds"
```

You can also provide multiple keys:

```bash
node update-merkle-tree.js "~key1.data" "~key2.data" "~key3.data"
```

Or read keys from a file (one key per line):

```bash
node update-merkle-tree.js --file=keys.txt
```

On Windows, you can also use the batch file:

```
update-merkle-tree.bat "~3JzCo5CwXFFARxwQqcvcDLUyZamResDCKv6qjTMd6bc.ILGaoRoGMfXBu4ISfTaJKfz4p_c-qxnlALCED8Gt_ds"
```

## Key Format

The GunDB public keys are in the format:

```
~3JzCo5CwXFFARxwQqcvcDLUyZamResDCKv6qjTMd6bc.ILGaoRoGMfXBu4ISfTaJKfz4p_c-qxnlALCED8Gt_ds
```

Where:
- `~` is the prefix
- The first part before the dot is the main public key
- The part after the dot is additional data

The scripts extract the main public key and convert it to hex format for use in the Merkle tree. 