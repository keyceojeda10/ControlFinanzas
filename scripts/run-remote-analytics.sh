#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
OUTFILE="$SCRIPT_DIR/analytics-results.txt"

# Copy the analytics script to VPS
scp -o ConnectTimeout=15 -o StrictHostKeyChecking=no "$SCRIPT_DIR/bot-analytics-remote.cjs" root@69.62.87.141:/home/control-finanzas/scripts/ > "$OUTFILE" 2>&1

# Run it on VPS and capture output
ssh -o ConnectTimeout=15 -o StrictHostKeyChecking=no root@69.62.87.141 "cd /home/control-finanzas && node scripts/bot-analytics-remote.cjs" >> "$OUTFILE" 2>&1

echo "EXIT: $?" >> "$OUTFILE"
