#!/bin/sh
# Start both the ingest scheduler and the signal engine as background processes.
# The shell script waits for either to exit, then exits itself
# (Docker will restart the container if the policy is set to always/on-failure).

node scheduler.js &
SCHEDULER_PID=$!

node signal-engine.js &
SIGNAL_PID=$!

# Wait for either process to exit
wait -n $SCHEDULER_PID $SIGNAL_PID
EXIT_CODE=$?

echo "[entrypoint] A process exited with code ${EXIT_CODE} — shutting down container"
exit $EXIT_CODE
