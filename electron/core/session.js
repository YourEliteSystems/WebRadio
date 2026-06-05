let sessionStart = null;
let sessionId = null;

function generateSessionId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

function startSession() {
  sessionStart = Date.now();
  sessionId = generateSessionId();
}

function endSession() {
  if (!sessionStart) return;

  const end = Date.now();
  const duration = end - sessionStart;
}

function getSession() {
  return {
    sessionId,
    sessionStart
  };
}

module.exports = {
  startSession,
  endSession,
  getSession
};