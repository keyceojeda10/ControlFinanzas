#!/bin/bash
OUTPUT_FILE="c:/Users/keyce/Desktop/Control Finanzas/scripts/analytics-output.txt"
echo "Starting..." > "$OUTPUT_FILE"
ssh -o ConnectTimeout=15 -o StrictHostKeyChecking=no root@69.62.87.141 "echo CONNECTED" >> "$OUTPUT_FILE" 2>&1
echo "SSH exit code: $?" >> "$OUTPUT_FILE"
