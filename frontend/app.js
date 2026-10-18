/**
 * DealGuard - AI Negotiation Rehearsal for Freelancers
 * Frontend Controller & State Machine
 */

// Determine API base: if opened via file://, use localhost:8000, otherwise relative
const API_BASE = window.location.protocol === 'file:' ? 'http://localhost:8000' : '';

// State Machine
const state = {
  activeScreen: 'setup', // 'setup', 'simulation', 'scorepanel', 'finalplan'
  setup: {
    client_message: '',
    service: '',
    quoted_price: 25000,
    minimum_price: 18000,
    currency: 'INR',
    deadline: '7-10 days',
    non_negotiables: ['50% advance payment', '7-day timeline', 'Revisions limited to two rounds']
  },
  roundNumber: 1,
  maxRounds: 5,
  dealStatus: 'ongoing',
  turns: [], // history of { client_message, freelancer_reply, tactic, score, feedback, suggested_reply }
  latestScores: {
    price_defence: 0,
    scope_protection: 0,
    professional_tone: 0,
    overcommitment_risk: 0
  },
  engineStatus: {
    connected: false,
    active_model: 'gemma3',
    engine: 'simulation'
  }
};

// DOM Elements
const elements = {
  // Navigation & Status
  statusPill: document.getElementById('status-pill'),
  statusText: document.getElementById('status-text'),
  stepItems: document.querySelectorAll('.step-item'),
  screens: {
    setup: document.getElementById('screen-setup'),
    arena: document.getElementById('screen-arena'),
    plan: document.getElementById('screen-plan')
  },
  historyCount: document.getElementById('history-count'),
  btnResetNav: document.getElementById('btn-reset-nav'),
  btnHistoryToggle: document.getElementById('btn-history-toggle'),
  historyModal: document.getElementById('history-modal'),
  historyList: document.getElementById('history-list-container'),
  btnCloseHistory: document.getElementById('btn-close-history'),
  btnClearHistory: document.getElementById('btn-clear-history'),

  // Screen 1: Setup
  btnLoadDemo: document.getElementById('btn-load-demo'),
  formSetup: document.getElementById('setup-form'),
  inputClientMsg: document.getElementById('input-client-message'),
  inputService: document.getElementById('input-service'),
  inputQuoted: document.getElementById('input-quoted-price'),
  inputMin: document.getElementById('input-min-price'),
  inputCurrency: document.getElementById('input-currency'),
  labelCurrencyPrefix: document.getElementById('label-currency-prefix'),
  inputDeadline: document.getElementById('input-deadline'),
  nonNegsContainer: document.getElementById('non-negs-container'),
  inputNewNonNeg: document.getElementById('input-new-non-neg'),
  btnAddNonNeg: document.getElementById('btn-add-non-neg'),
  btnStartSim: document.getElementById('btn-start-simulation'),

  // Screen 2: Simulation
  badgeService: document.getElementById('badge-service'),
  badgePrices: document.getElementById('badge-prices'),
  badgeDeadline: document.getElementById('badge-deadline'),
  currentRound: document.getElementById('current-round'),
  chatThread: document.getElementById('chat-thread'),
  freelancerInput: document.getElementById('freelancer-reply-input'),
  btnSendReply: document.getElementById('btn-send-reply'),
  quickReplies: document.querySelectorAll('.btn-quick-reply'),

  // Screen 3: Score Panel
  dealStatusBadge: document.getElementById('deal-status-badge'),
  valPriceDef: document.getElementById('val-price-defence'),
  barPriceDef: document.getElementById('bar-price-defence'),
  valScopeProt: document.getElementById('val-scope-protection'),
  barScopeProt: document.getElementById('bar-scope-protection'),
  valProfTone: document.getElementById('val-prof-tone'),
  barProfTone: document.getElementById('bar-prof-tone'),
  valOvercommit: document.getElementById('val-overcommit-risk'),
  barOvercommit: document.getElementById('bar-overcommit-risk'),
  tagOvercommit: document.getElementById('tag-overcommit'),
  coachFeedbackText: document.getElementById('coach-feedback-text'),
  suggestedContainer: document.getElementById('suggested-reply-container'),
  suggestedReplyText: document.getElementById('suggested-reply-text'),
  btnUseSuggested: document.getElementById('btn-use-suggested'),
  btnGeneratePlan: document.getElementById('btn-generate-plan'),

  // Screen 4: Final Plan
  planDealSummary: document.getElementById('plan-deal-summary'),
  avgPriceDef: document.getElementById('avg-price-def'),
  avgScopeProt: document.getElementById('avg-scope-prot'),
  avgProfTone: document.getElementById('avg-prof-tone'),
  avgOvercommit: document.getElementById('avg-overcommit'),
  planCurrency: document.getElementById('plan-currency'),
  planRecommendedPrice: document.getElementById('plan-recommended-price'),
  planPriceRationale: document.getElementById('plan-price-rationale'),
  planBoundariesList: document.getElementById('plan-boundaries-list'),
  planRisksList: document.getElementById('plan-risks-list'),
  planNextActionText: document.getElementById('plan-next-action-text'),
  btnCopyPlan: document.getElementById('btn-copy-plan'),
  copyPlanText: document.getElementById('copy-plan-text'),
  btnCopyScript: document.getElementById('btn-copy-script'),
  copyScriptText: document.getElementById('copy-script-text'),
  btnRehearseAgain: document.getElementById('btn-rehearse-again'),

  // Toast
  toast: document.getElementById('toast')
};

// =========================================================
// Initialization
// =========================================================

document.addEventListener('DOMContentLoaded', () => {
  renderNonNegChips();
  bindEvents();
  checkEngineStatus();
  updateHistoryBadge();
  updateLiveDealSummary();
});

// =========================================================
// API & Health Checks
// =========================================================

async function checkEngineStatus() {
  try {
    const res = await fetch(`${API_BASE}/api/status`);
    if (res.ok) {
      const data = await res.json();
      state.engineStatus = data;
      renderEngineStatus(data);
      return;
    }
  } catch (err) {
    // Backend offline or running in mock
  }
  renderEngineStatus({
    connected: false,
    engine: 'simulation',
    ollama: { active_model: 'gemma3' }
  });
}

function renderEngineStatus(data) {
  elements.statusPill.className = 'status-pill';
  if (data.ollama && data.ollama.connected) {
    elements.statusPill.classList.add('status-connected');
    elements.statusText.textContent = `🟢 Ollama: ${data.ollama.active_model || 'gemma3'}`;
    elements.statusPill.title = 'Connected directly to local Ollama inference daemon';
  } else {
    elements.statusPill.classList.add('status-simulation');
    elements.statusText.textContent = '⚡ Simulation Engine (Offline)';
    elements.statusPill.title = 'Local heuristic simulation active. Start Ollama with gemma3 for neural inference.';
  }
}

// =========================================================
// Event Listeners
// =========================================================

function bindEvents() {
  // Navigation / Steps
  elements.stepItems.forEach(item => {
    item.addEventListener('click', () => {
      const target = item.dataset.screen;
      if (target === 'setup') navigateToScreen('setup');
      else if (target === 'simulation' || target === 'scorepanel') {
        if (!state.setup.client_message) {
          showToast('Please fill out the deal setup first.');
          return;
        }
        navigateToScreen('simulation');
      } else if (target === 'finalplan') {
        if (state.turns.length === 0) {
          showToast('Please complete at least one simulation turn first.');
          return;
        }
        generateFinalPlan();
      }
    });
  });

  // Currency select change
  elements.inputCurrency.addEventListener('change', (e) => {
    const cur = e.target.value;
    const symbolMap = { 'INR': '₹', 'USD': '$', 'EUR': '€', 'GBP': '£' };
    elements.labelCurrencyPrefix.textContent = symbolMap[cur] || cur;
  });

  // Non-negotiables Chip addition
  elements.btnAddNonNeg.addEventListener('click', addNonNegChip);
  elements.inputNewNonNeg.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addNonNegChip();
    }
  });

  // Demo Scenario button
  elements.btnLoadDemo.addEventListener('click', loadDemoScenario);

  // Start Simulation button
  elements.btnStartSim.addEventListener('click', startSimulation);

  // Send Freelancer Reply
  elements.btnSendReply.addEventListener('click', sendFreelancerReply);
  elements.freelancerInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendFreelancerReply();
    }
  });

  // Quick reply buttons
  elements.quickReplies.forEach(btn => {
    btn.addEventListener('click', () => {
      elements.freelancerInput.value = btn.dataset.text;
      elements.freelancerInput.focus();
    });
  });

  // Use suggested reply
  elements.btnUseSuggested.addEventListener('click', () => {
    elements.freelancerInput.value = elements.suggestedReplyText.textContent;
    elements.freelancerInput.focus();
    showToast('Suggested reply loaded into input');
  });

  // Generate Plan button
  elements.btnGeneratePlan.addEventListener('click', generateFinalPlan);

  // Copy Plan & Script
  elements.btnCopyPlan.addEventListener('click', copyFullPlanToClipboard);
  elements.btnCopyScript.addEventListener('click', copyScriptToClipboard);

  // Rehearse Again
  elements.btnRehearseAgain.addEventListener('click', () => {
    navigateToScreen('setup');
  });

  // Reset Nav
  elements.btnResetNav.addEventListener('click', () => {
    if (confirm('Start a fresh rehearsal session?')) {
      resetSession();
      navigateToScreen('setup');
    }
  });

  // History Modal
  elements.btnHistoryToggle.addEventListener('click', openHistoryModal);
  elements.btnCloseHistory.addEventListener('click', closeHistoryModal);
  elements.btnClearHistory.addEventListener('click', clearHistory);
  elements.historyModal.addEventListener('click', (e) => {
    if (e.target === elements.historyModal) closeHistoryModal();
  });

  // Real-time Live Deal Summary Listeners
  [elements.inputClientMsg, elements.inputService, elements.inputQuoted, elements.inputMin, elements.inputDeadline].forEach(input => {
    if (input) input.addEventListener('input', updateLiveDealSummary);
  });
  if (elements.inputCurrency) {
    elements.inputCurrency.addEventListener('change', updateLiveDealSummary);
  }

  // Quick Terms Suggestion Buttons
  document.querySelectorAll('.btn-term-suggest').forEach(btn => {
    btn.addEventListener('click', () => {
      const term = btn.dataset.term;
      if (term && !state.setup.non_negotiables.includes(term)) {
        state.setup.non_negotiables.push(term);
        renderNonNegChips();
        updateLiveDealSummary();
        showToast(`Added term: ${term}`);
      }
    });
  });

  // Hero Sample Deal Button
  const heroSample = document.getElementById('hero-btn-sample');
  if (heroSample) {
    heroSample.addEventListener('click', () => {
      loadDemoScenario();
      const setupAnchor = document.getElementById('setup-workspace-anchor');
      if (setupAnchor) setupAnchor.scrollIntoView({ behavior: 'smooth' });
    });
  }
}

// =========================================================
// Setup Screen Logic
// =========================================================

function loadDemoScenario() {
  elements.inputClientMsg.value = 'Hi, I need a 5-page website with booking, payments, and SEO. My budget is ₹8,000. I need it in 3 days.';
  elements.inputService.value = 'Full-Stack Web App (5 Pages + Booking + Payment Gateway + SEO)';
  elements.inputQuoted.value = 25000;
  elements.inputMin.value = 18000;
  elements.inputCurrency.value = 'INR';
  elements.labelCurrencyPrefix.textContent = '₹';
  elements.inputDeadline.value = '7 business days';
  
  state.setup.non_negotiables = [
    '50% advance payment required',
    '7-day turnaround timeline',
    'Revisions strictly limited to two rounds'
  ];
  renderNonNegChips();
  updateLiveDealSummary();
  showToast('⚡ Demo Scenario loaded (₹8k vs ₹25k Project)');
}

function addNonNegChip() {
  const val = elements.inputNewNonNeg.value.trim();
  if (val && !state.setup.non_negotiables.includes(val)) {
    state.setup.non_negotiables.push(val);
    renderNonNegChips();
    updateLiveDealSummary();
    elements.inputNewNonNeg.value = '';
  }
}

function removeNonNegChip(index) {
  state.setup.non_negotiables.splice(index, 1);
  renderNonNegChips();
  updateLiveDealSummary();
}

function renderNonNegChips() {
  // Clear existing chips except the input wrapper
  const existingChips = elements.nonNegsContainer.querySelectorAll('.chip-tag');
  existingChips.forEach(c => c.remove());

  const inputWrapper = elements.nonNegsContainer.querySelector('.chip-input-wrapper');

  state.setup.non_negotiables.forEach((item, idx) => {
    const chip = document.createElement('span');
    chip.className = 'chip-tag';
    chip.innerHTML = `
      <span>${escapeHtml(item)}</span>
      <button type="button" class="chip-remove" title="Remove" onclick="removeNonNegChip(${idx})">&times;</button>
    `;
    elements.nonNegsContainer.insertBefore(chip, inputWrapper);
  });
}
window.removeNonNegChip = removeNonNegChip;

function updateLiveDealSummary() {
  const cur = elements.inputCurrency ? elements.inputCurrency.value : 'INR';
  const symMap = { 'INR': '₹', 'USD': '$', 'EUR': '€', 'GBP': '£' };
  const sym = symMap[cur] || cur;
  const quoted = parseFloat(elements.inputQuoted?.value) || 0;
  const min = parseFloat(elements.inputMin?.value) || 0;
  const service = elements.inputService?.value?.trim() || 'Custom Offering';
  const deadline = elements.inputDeadline?.value?.trim() || 'Not specified';

  const liveQuoted = document.getElementById('live-quoted-display');
  const liveFloor = document.getElementById('live-floor-display');
  const liveCushion = document.getElementById('live-cushion-display');
  const liveBufferBar = document.getElementById('live-buffer-bar');
  const liveService = document.getElementById('live-service-display');
  const liveTimeline = document.getElementById('live-timeline-display');
  const liveBoundaries = document.getElementById('live-boundaries-checklist');
  const liveStanceBadge = document.getElementById('live-stance-badge');
  const liveStanceText = document.getElementById('live-stance-text');

  if (liveQuoted) liveQuoted.textContent = `${sym}${quoted.toLocaleString()}`;
  if (liveFloor) liveFloor.textContent = `${sym}${min.toLocaleString()}`;
  if (liveService) liveService.textContent = service;
  if (liveTimeline) liveTimeline.textContent = deadline;

  if (liveCushion && liveBufferBar) {
    if (quoted > 0 && min > 0) {
      if (min > quoted) {
        liveCushion.textContent = 'Floor exceeds Quote!';
        liveBufferBar.style.width = '100%';
        liveBufferBar.style.background = '#ef4444';
        if (liveStanceBadge) {
          liveStanceBadge.className = 'preview-health-pill stance-risk';
          if (liveStanceText) liveStanceText.textContent = 'Invalid Floor';
        }
      } else {
        const buffer = quoted - min;
        const pct = Math.round((buffer / quoted) * 100);
        liveCushion.textContent = `${sym}${buffer.toLocaleString()} (${pct}% buffer)`;
        const barPct = Math.min(100, Math.max(10, Math.round(((quoted - buffer) / quoted) * 100)));
        liveBufferBar.style.width = `${barPct}%`;
        liveBufferBar.style.background = '';
        if (liveStanceBadge) {
          liveStanceBadge.className = 'preview-health-pill';
          if (liveStanceText) liveStanceText.textContent = 'Ready to Defend';
        }
      }
    }
  }

  if (liveBoundaries) {
    liveBoundaries.innerHTML = '';
    state.setup.non_negotiables.forEach(term => {
      const li = document.createElement('li');
      li.innerHTML = `<span class="check-icon">✓</span> <span>${escapeHtml(term)}</span>`;
      liveBoundaries.appendChild(li);
    });
    if (state.setup.non_negotiables.length === 0) {
      const li = document.createElement('li');
      li.innerHTML = `<span style="color: var(--text-subtle); font-style: italic;">No non-negotiables added yet</span>`;
      liveBoundaries.appendChild(li);
    }
  }

  // Also mirror into arena boundaries list
  const arenaList = document.getElementById('arena-boundaries-list');
  if (arenaList) {
    arenaList.innerHTML = '';
    state.setup.non_negotiables.forEach(term => {
      const li = document.createElement('li');
      li.innerHTML = `<span class="check-icon">🛡️</span> <span>${escapeHtml(term)}</span>`;
      arenaList.appendChild(li);
    });
  }
}

function startSimulation() {
  const clientMsg = elements.inputClientMsg.value.trim();
  const service = elements.inputService.value.trim();
  const quoted = parseFloat(elements.inputQuoted.value);
  const min = parseFloat(elements.inputMin.value);
  const deadline = elements.inputDeadline.value.trim();
  const currency = elements.inputCurrency.value;

  if (!clientMsg || !service || isNaN(quoted) || isNaN(min) || !deadline) {
    showToast('Please complete all required fields.');
    return;
  }

  if (min > quoted) {
    showToast('Minimum acceptable rate cannot exceed quoted rate.');
    return;
  }

  state.setup = {
    client_message: clientMsg,
    service: service,
    quoted_price: quoted,
    minimum_price: min,
    currency: currency,
    deadline: deadline,
    non_negotiables: [...state.setup.non_negotiables]
  };

  state.roundNumber = 1;
  state.dealStatus = 'ongoing';
  state.turns = [];

  // Update Arena Badges
  const symMap = { 'INR': '₹', 'USD': '$', 'EUR': '€', 'GBP': '£' };
  const sym = symMap[currency] || currency;

  elements.badgeService.textContent = service;
  elements.badgePrices.textContent = `Quote: ${sym}${quoted.toLocaleString()} | Floor: ${sym}${min.toLocaleString()}`;
  elements.badgeDeadline.textContent = deadline;
  elements.currentRound.textContent = '1';

  // Clear Chat Thread and add initial client bubble
  elements.chatThread.innerHTML = '';
  appendClientMessage(clientMsg, 'Initial Inquiry');

  // Reset Metrics & Feedback
  updateMetricBars({ price_defence: 0, scope_protection: 0, professional_tone: 0, overcommitment_risk: 0 });
  elements.coachFeedbackText.textContent = 'Rehearsal active. Respond to the client above to evaluate your price defence and tone.';
  elements.suggestedContainer.style.display = 'none';
  elements.dealStatusBadge.className = 'badge-status status-ongoing';
  elements.dealStatusBadge.textContent = 'Ongoing';

  // Mirror boundaries into arena list
  updateLiveDealSummary();

  navigateToScreen('simulation');
}

// =========================================================
// Simulation Chat & Turns
// =========================================================

async function sendFreelancerReply() {
  const reply = elements.freelancerInput.value.trim();
  if (!reply) return;

  // Append Freelancer Message immediately
  appendFreelancerMessage(reply);
  elements.freelancerInput.value = '';

  // Show typing loader
  const loaderId = appendTypingIndicator();

  // Disable send button while awaiting response
  elements.btnSendReply.disabled = true;
  elements.btnSendReply.style.opacity = '0.6';

  try {
    const payload = {
      setup: state.setup,
      reply: reply,
      conversation_history: buildConversationHistory(),
      round_number: state.roundNumber
    };

    const res = await fetch(`${API_BASE}/api/negotiate/step`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    removeTypingIndicator(loaderId);

    if (res.ok) {
      const data = await res.json();
      handleTurnResponse(reply, data);
    } else {
      // Offline fallback
      handleOfflineTurn(reply);
    }
  } catch (err) {
    removeTypingIndicator(loaderId);
    handleOfflineTurn(reply);
  } finally {
    elements.btnSendReply.disabled = false;
    elements.btnSendReply.style.opacity = '1';
    elements.freelancerInput.focus();
  }
}

function handleTurnResponse(freelancerReply, turnData) {
  // Store turn
  state.turns.push({
    client_message: turnData.client_message,
    freelancer_reply: freelancerReply,
    pressure_tactic: turnData.pressure_tactic,
    score: turnData.score,
    feedback: turnData.feedback,
    suggested_reply: turnData.suggested_reply,
    round: state.roundNumber
  });

  // Update Score bars
  updateMetricBars(turnData.score);

  // Update Coach Feedback
  elements.coachFeedbackText.textContent = turnData.feedback || 'Good counter.';
  if (turnData.suggested_reply) {
    elements.suggestedReplyText.textContent = turnData.suggested_reply;
    elements.suggestedContainer.style.display = 'flex';
  } else {
    elements.suggestedContainer.style.display = 'none';
  }

  // Update Deal Status
  state.dealStatus = turnData.deal_status || 'ongoing';
  elements.dealStatusBadge.textContent = state.dealStatus;
  elements.dealStatusBadge.className = `badge-status status-${state.dealStatus === 'walked away' ? 'walked' : state.dealStatus}`;

  // Check if negotiation reached conclusion or maximum rounds
  if (turnData.is_complete || state.roundNumber >= state.maxRounds) {
    if (turnData.client_message && state.dealStatus !== 'accepted') {
      appendClientMessage(turnData.client_message, turnData.pressure_tactic);
    }
    showToast(`Simulation complete (${state.dealStatus}). Finalizing plan...`);
    elements.btnGeneratePlan.classList.add('pulse-button');
    setTimeout(() => {
      generateFinalPlan();
    }, 1200);
    return;
  }

  // Increment round
  state.roundNumber += 1;
  elements.currentRound.textContent = state.roundNumber;

  // Append Client's Next Objection
  appendClientMessage(turnData.client_message, turnData.pressure_tactic);
}

function handleOfflineTurn(reply) {
  // Graceful client fallback for offline environments
  const fallbackScore = {
    price_defence: reply.length > 20 ? 8 : 5,
    scope_protection: reply.toLowerCase().includes('unlimited') ? 2 : 8,
    professional_tone: 8,
    overcommitment_risk: reply.toLowerCase().includes('unlimited') ? 9 : 2
  };
  const turnData = {
    round_number: state.roundNumber,
    client_message: state.roundNumber === 1 
      ? 'Another developer said ₹10,000 for this exact setup. Why should I pay your rate?'
      : 'Can you include free hosting and unlimited revisions if I pay tomorrow?',
    pressure_tactic: state.roundNumber === 1 ? 'comparison' : 'scope creep',
    deal_status: 'ongoing',
    score: fallbackScore,
    feedback: 'Keep your scope boundaries clear and protect your 2-round revision policy.',
    suggested_reply: 'I provide dedicated architectural QA and secure payments. Revisions are strictly capped at 2 rounds.',
    is_complete: state.roundNumber >= 5
  };
  handleTurnResponse(reply, turnData);
}

function buildConversationHistory() {
  const history = [];
  history.push({ speaker: 'Client', text: state.setup.client_message });
  state.turns.forEach(t => {
    history.push({ speaker: 'Freelancer', text: t.freelancer_reply });
    history.push({ speaker: 'Client', text: t.client_message });
  });
  return history;
}

// =========================================================
// Chat UI Rendering
// =========================================================

function appendClientMessage(text, tactic) {
  const div = document.createElement('div');
  div.className = 'chat-msg client';
  
  const tacticDisplay = tactic && tactic !== 'none' ? `<span class="tactic-badge">⚠️ ${escapeHtml(tactic)}</span>` : '';

  div.innerHTML = `
    <div class="msg-header">
      <span class="msg-sender">Client</span>
      ${tacticDisplay}
    </div>
    <div class="msg-bubble">${escapeHtml(text)}</div>
  `;
  elements.chatThread.appendChild(div);
  elements.chatThread.scrollTop = elements.chatThread.scrollHeight;
}

function appendFreelancerMessage(text) {
  const div = document.createElement('div');
  div.className = 'chat-msg freelancer';
  div.innerHTML = `
    <div class="msg-header">
      <span class="msg-sender">You (Freelancer)</span>
    </div>
    <div class="msg-bubble">${escapeHtml(text)}</div>
  `;
  elements.chatThread.appendChild(div);
  elements.chatThread.scrollTop = elements.chatThread.scrollHeight;
}

function appendTypingIndicator() {
  const id = 'typing-' + Date.now();
  const div = document.createElement('div');
  div.id = id;
  div.className = 'chat-msg client';
  div.innerHTML = `
    <div class="msg-header"><span class="msg-sender">DealGuard Simulating Client...</span></div>
    <div class="msg-bubble" style="color: var(--text-subtle); font-style: italic;">
      Analyzing objection & scoring reply...
    </div>
  `;
  elements.chatThread.appendChild(div);
  elements.chatThread.scrollTop = elements.chatThread.scrollHeight;
  return id;
}

function removeTypingIndicator(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

// =========================================================
// Score Panel Rendering
// =========================================================

function updateMetricBars(scores) {
  state.latestScores = scores;

  // 1. Price Defence
  const pd = scores.price_defence || 0;
  elements.valPriceDef.textContent = `${pd}/10`;
  elements.barPriceDef.style.width = `${pd * 10}%`;

  // 2. Scope Protection
  const sp = scores.scope_protection || 0;
  elements.valScopeProt.textContent = `${sp}/10`;
  elements.barScopeProt.style.width = `${sp * 10}%`;

  // 3. Professional Tone
  const pt = scores.professional_tone || 0;
  elements.valProfTone.textContent = `${pt}/10`;
  elements.barProfTone.style.width = `${pt * 10}%`;

  // 4. Overcommitment Risk
  const or = scores.overcommitment_risk || 0;
  elements.valOvercommit.textContent = `${or}/10`;
  elements.barOvercommit.style.width = `${or * 10}%`;
  
  if (or >= 7) {
    elements.tagOvercommit.textContent = 'HIGH RISK';
    elements.tagOvercommit.style.background = 'rgba(239, 68, 68, 0.2)';
    elements.tagOvercommit.style.color = '#f87171';
  } else if (or >= 4) {
    elements.tagOvercommit.textContent = 'Moderate';
    elements.tagOvercommit.style.background = 'rgba(245, 158, 11, 0.2)';
    elements.tagOvercommit.style.color = '#fbbf24';
  } else {
    elements.tagOvercommit.textContent = 'Low';
    elements.tagOvercommit.style.background = 'rgba(16, 185, 129, 0.2)';
    elements.tagOvercommit.style.color = '#34d399';
  }
}

// =========================================================
// Screen 4: Final Negotiation Plan
// =========================================================

async function generateFinalPlan() {
  showToast('Synthesizing Negotiation Playbook...');
  
  try {
    const payload = {
      setup: state.setup,
      turns: state.turns
    };

    const res = await fetch(`${API_BASE}/api/negotiate/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      const plan = await res.json();
      renderFinalPlan(plan);
    } else {
      renderFallbackFinalPlan();
    }
  } catch (err) {
    renderFallbackFinalPlan();
  }

  saveSessionToStorage();
  navigateToScreen('finalplan');
}

function renderFinalPlan(plan) {
  const symMap = { 'INR': '₹', 'USD': '$', 'EUR': '€', 'GBP': '£' };
  const sym = symMap[plan.currency] || plan.currency || '₹';

  elements.planDealSummary.textContent = plan.deal_summary || 'Custom negotiation strategy synthesized from rehearsal rounds.';
  elements.planCurrency.textContent = sym;
  elements.planRecommendedPrice.textContent = Number(plan.recommended_price).toLocaleString();

  // Averages ribbon
  if (plan.average_scores) {
    elements.avgPriceDef.textContent = plan.average_scores.price_defence || '0.0';
    elements.avgScopeProt.textContent = plan.average_scores.scope_protection || '0.0';
    elements.avgProfTone.textContent = plan.average_scores.professional_tone || '0.0';
    elements.avgOvercommit.textContent = plan.average_scores.overcommitment_risk || '0.0';
  }

  // Boundaries list
  elements.planBoundariesList.innerHTML = '';
  (plan.boundaries_in_writing || []).forEach(b => {
    const li = document.createElement('li');
    li.textContent = b;
    elements.planBoundariesList.appendChild(li);
  });

  // Risks list
  elements.planRisksList.innerHTML = '';
  (plan.risks_identified || []).forEach(r => {
    const li = document.createElement('li');
    li.textContent = r;
    elements.planRisksList.appendChild(li);
  });

  // Next action script
  elements.planNextActionText.textContent = plan.next_action;
}

function renderFallbackFinalPlan() {
  const setup = state.setup;
  const symMap = { 'INR': '₹', 'USD': '$', 'EUR': '€', 'GBP': '£' };
  const sym = symMap[setup.currency] || setup.currency;
  const recommended = Math.max(setup.minimum_price, Math.round((setup.quoted_price * 0.7 + setup.minimum_price * 0.3) / 100) * 100);

  const fallback = {
    recommended_price: recommended,
    currency: setup.currency,
    boundaries_in_writing: [
      '50% deposit payable before commencement of work.',
      `Final delivery strictly slated for ${setup.deadline}.`,
      'Maximum 2 rounds of design and copy revisions.',
      'Third-party hosting and domain accounts managed directly by client.'
    ],
    risks_identified: [
      'Client anchoring to lowball figure (₹8k) with high expectations.',
      'Scope creep threat regarding unlimited revisions and unpaid hosting.'
    ],
    next_action: `Hi, thank you for considering my services. To build a robust 5-page site with integrated bookings and secure payments, our fixed project investment is ${sym}${recommended.toLocaleString()} on a ${setup.deadline} turnaround. This includes 2 revision rounds and full QA testing. I require a 50% advance to initiate the development sprint. Shall I send over the agreement?`,
    deal_summary: 'Rehearsal established strong rate floor and guarded against unpaid scope creep.',
    average_scores: {
      price_defence: 8.5,
      scope_protection: 8.0,
      professional_tone: 9.0,
      overcommitment_risk: 1.5
    }
  };
  renderFinalPlan(fallback);
}

// =========================================================
// Local Storage & History
// =========================================================

function saveSessionToStorage() {
  try {
    const existing = JSON.parse(localStorage.getItem('dealguard_sessions') || '[]');
    const newSession = {
      id: 'dg-' + Date.now(),
      timestamp: new Date().toISOString(),
      service: state.setup.service,
      quoted_price: state.setup.quoted_price,
      currency: state.setup.currency,
      turns_count: state.turns.length,
      deal_status: state.dealStatus
    };
    existing.unshift(newSession);
    localStorage.setItem('dealguard_sessions', JSON.stringify(existing.slice(0, 20)));
    updateHistoryBadge();
  } catch (err) {
    console.warn('LocalStorage save failed:', err);
  }
}

function updateHistoryBadge() {
  try {
    const existing = JSON.parse(localStorage.getItem('dealguard_sessions') || '[]');
    elements.historyCount.textContent = existing.length;
  } catch (err) {
    elements.historyCount.textContent = '0';
  }
}

function openHistoryModal() {
  try {
    const sessions = JSON.parse(localStorage.getItem('dealguard_sessions') || '[]');
    elements.historyList.innerHTML = '';
    
    if (sessions.length === 0) {
      elements.historyList.innerHTML = `
        <div style="text-align: center; color: var(--text-subtle); padding: 30px 10px;">
          No previous sessions saved yet. Rehearse a deal and generate a plan!
        </div>
      `;
    } else {
      sessions.forEach(s => {
        const item = document.createElement('div');
        item.className = 'history-item';
        const dateStr = new Date(s.timestamp).toLocaleDateString(undefined, {
          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });
        item.innerHTML = `
          <div class="history-meta">
            <span>${dateStr}</span>
            <span class="badge-status status-${s.deal_status === 'walked away' ? 'walked' : s.deal_status}">${s.deal_status}</span>
          </div>
          <div class="history-title">${escapeHtml(s.service)}</div>
          <div class="hint">${s.currency} ${s.quoted_price.toLocaleString()} • ${s.turns_count} rounds rehearsed</div>
        `;
        elements.historyList.appendChild(item);
      });
    }
    elements.historyModal.classList.add('open');
  } catch (err) {
    showToast('Failed to load history.');
  }
}

function closeHistoryModal() {
  elements.historyModal.classList.remove('open');
}

function clearHistory() {
  if (confirm('Clear all saved negotiation sessions?')) {
    localStorage.removeItem('dealguard_sessions');
    updateHistoryBadge();
    closeHistoryModal();
    showToast('History cleared.');
  }
}

function resetSession() {
  state.roundNumber = 1;
  state.turns = [];
  state.dealStatus = 'ongoing';
  elements.chatThread.innerHTML = '';
  elements.suggestedContainer.style.display = 'none';
  updateMetricBars({ price_defence: 0, scope_protection: 0, professional_tone: 0, overcommitment_risk: 0 });
}

// =========================================================
// Clipboard Helpers
// =========================================================

function copyFullPlanToClipboard() {
  const title = `DealGuard Negotiation Strategy - ${state.setup.service}\n`;
  const price = `Recommended Price: ${elements.planCurrency.textContent}${elements.planRecommendedPrice.textContent}\n\n`;
  
  let boundaries = 'Boundaries in Writing:\n';
  elements.planBoundariesList.querySelectorAll('li').forEach(li => {
    boundaries += `- ${li.textContent}\n`;
  });

  let risks = '\nRisks Identified:\n';
  elements.planRisksList.querySelectorAll('li').forEach(li => {
    risks += `- ${li.textContent}\n`;
  });

  const script = `\nImmediate Client Script:\n${elements.planNextActionText.textContent}\n`;

  const fullText = title + price + boundaries + risks + script;

  navigator.clipboard.writeText(fullText).then(() => {
    elements.copyPlanText.textContent = '✓ Copied!';
    setTimeout(() => { elements.copyPlanText.textContent = 'Copy Full Plan'; }, 2000);
    showToast('Full Negotiation Plan copied to clipboard!');
  }).catch(() => {
    showToast('Clipboard access denied.');
  });
}

function copyScriptToClipboard() {
  const text = elements.planNextActionText.textContent;
  navigator.clipboard.writeText(text).then(() => {
    elements.copyScriptText.textContent = '✓ Copied!';
    setTimeout(() => { elements.copyScriptText.textContent = 'Copy Script'; }, 2000);
    showToast('Ready-to-send script copied to clipboard!');
  }).catch(() => {
    showToast('Clipboard access denied.');
  });
}

// =========================================================
// Navigation & Utilities
// =========================================================

function navigateToScreen(screen) {
  state.activeScreen = screen;

  // Update step indicators
  elements.stepItems.forEach(item => {
    const step = item.dataset.screen;
    if (step === screen || (screen === 'simulation' && step === 'scorepanel')) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  // Switch visible screen container
  elements.screens.setup.classList.remove('active');
  elements.screens.arena.classList.remove('active');
  elements.screens.plan.classList.remove('active');

  if (screen === 'setup') {
    elements.screens.setup.classList.add('active');
  } else if (screen === 'simulation' || screen === 'scorepanel') {
    elements.screens.arena.classList.add('active');
    elements.freelancerInput.focus();
  } else if (screen === 'finalplan') {
    elements.screens.plan.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  elements.toast.appendChild(toast);
  setTimeout(() => { toast.remove(); }, 3200);
}

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
