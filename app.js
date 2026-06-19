
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getDatabase, ref, set, get, onValue, update, push, remove, onDisconnect, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

// Firebase config from user
const firebaseConfig = {
  apiKey: "AIzaSyC4DmP5xSITDs7wY1fPR_bScNqbqUx7UXo",
  authDomain: "classroommafia.firebaseapp.com",
  databaseURL: "https://classroommafia-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "classroommafia",
  storageBucket: "classroommafia.firebasestorage.app",
  messagingSenderId: "303384179715",
  appId: "1:303384179715:web:e02f38817efd9fea83ca36"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const ROLE_INFO = {
  mafia: { label: "마피아", desc: "매일 밤 팀원들과의 익명투표로 한 명을 제거합니다." },
  citizen: { label: "일반 시민", desc: "낮과 밤 일반 채팅을 통해 추리하고 토론합니다." },
  police: { label: "경찰", desc: "매일 밤 한 명이 마피아인지 확인합니다." },
  doctor: { label: "의사", desc: "매일 밤 한 명을 보호합니다. 본인 포함 가능." },
  thug: { label: "건달", desc: "매일 밤 한 명을 골라 다음 낮 투표에 참여하지 못하게 합니다." },
  terrorist: { label: "테러리스트", desc: "밤에 타겟을 정하고, 낮 투표로 처형되면 타겟도 함께 죽습니다." },
  reporter: { label: "기자", desc: "두 번째 밤부터 한 번만 취재하여 다음 날 역할을 공개합니다." },
  shaman: { label: "영매", desc: "매일 밤 죽은 사람 중 한 명의 직업을 알아냅니다." },
  priest: { label: "성직자", desc: "게임 중 한 번 죽은 사람 한 명을 부활시킵니다." },
  politician: { label: "정치인", desc: "낮 사형투표로 처형되지 않으며, 투표는 2표로 인정됩니다." },
  soldier: { label: "군인", desc: "마피아 공격을 한 번 버티고, 그때 마피아 한 명의 정체를 알게 됩니다." }
};

const DEFAULT_ROLE_COUNTS = {
  mafia: 1, citizen: 3, police: 1, doctor: 1, thug: 0,
  terrorist: 0, reporter: 0, shaman: 0, priest: 0, politician: 0, soldier: 0
};

const ui = {};
const state = {
  session: loadSession(),
  roomCode: null,
  role: null,
  me: null,
  room: null,
  listeners: [],
  heartbeat: null,
  countdown: null,
  audioCtx: null,
  lastOverlayKey: null,
};

document.addEventListener("DOMContentLoaded", init);

function init(){
  bindUi();
  renderRoleSettings();
  installGlobalHandlers();
  if (state.session?.roomCode) {
    recoverSession();
  } else {
    show("screenHome");
  }
}

function bindUi(){
  const ids = [
    "screenHome","screenTeacherSetup","screenStudentJoin","screenTeacherRoom","screenStudentRoom",
    "teacherName","defaultTimer","btnTeacherOpen","btnStudentOpen","btnCreateRoom","studentName","studentRoomCode",
    "btnStudentJoin","btnAssignRoles","btnStartNight","btnStartDay","btnResolveNight","btnTeacherLeave",
    "teacherRoomCode","pillPhase","pillConnection","teacherPhaseText","teacherTimerText","teacherPlayers",
    "teacherAnnouncement","btnSendAnnouncement","studentRoomCodeLabel","studentPhasePill","studentConnPill",
    "meName","meRole","meAlive","studentAnnouncement","studentActionArea","studentActionHelp","btnOpenRoleGuide",
    "btnStudentLeave","chatList","chatInput","btnSendChat","mafiaChatPanel","mafiaChatList","mafiaChatInput",
    "btnSendMafiaChat","overlay","overlayEyebrow","overlayTitle","overlayBody","btnCloseOverlay","btnGoHome",
    "btnManualReconnect","btnShowRevealDemo","btnShowDeathDemo"
  ];
  ids.forEach(id => ui[id] = document.getElementById(id));
  document.querySelectorAll("[data-back-home='1']").forEach(btn => btn.addEventListener("click", goHome));

  ui.btnTeacherOpen.onclick = () => show("screenTeacherSetup");
  ui.btnStudentOpen.onclick = () => show("screenStudentJoin");
  ui.btnCreateRoom.onclick = createRoom;
  ui.btnStudentJoin.onclick = joinRoom;
  ui.btnAssignRoles.onclick = assignRoles;
  ui.btnStartNight.onclick = () => startPhase("night");
  ui.btnStartDay.onclick = () => startPhase("day");
  ui.btnResolveNight.onclick = resolveNight;
  ui.btnTeacherLeave.onclick = teacherLeaveRoom;
  ui.btnStudentLeave.onclick = studentLeaveRoom;
  ui.btnSendAnnouncement.onclick = sendAnnouncement;
  ui.btnOpenRoleGuide.onclick = showMyRole;
  ui.btnSendChat.onclick = () => sendChat("general");
  ui.btnSendMafiaChat.onclick = () => sendChat("mafia");
  ui.btnCloseOverlay.onclick = hideOverlay;
  ui.btnGoHome.onclick = goHome;
  ui.btnManualReconnect.onclick = recoverSession;
  ui.btnShowRevealDemo.onclick = () => showOverlay("역할 공개", "군인", "당신은 군인입니다. 최초 1회 공격을 버팁니다.");
  ui.btnShowDeathDemo.onclick = () => showOverlay("사망", "희생자 발생", "이번 밤 희생자가 발생했습니다...");
}

function renderRoleSettings(){
  const root = document.getElementById("roleSettings");
  root.innerHTML = "";
  Object.entries(ROLE_INFO).forEach(([key, info]) => {
    const item = document.createElement("div");
    item.className = "role-item";
    item.innerHTML = `<label>${info.label}</label><input type="number" min="0" value="${DEFAULT_ROLE_COUNTS[key] ?? 0}" data-role-count="${key}">`;
    root.appendChild(item);
  });
}

function installGlobalHandlers(){
  document.addEventListener("click", (e) => {
    if (e.target.closest("button")) playClickSound();
  });
  window.addEventListener("online", () => {
    setConnPill(true);
    recoverSession();
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) recoverSession();
  });
}

function show(id){
  ["screenHome","screenTeacherSetup","screenStudentJoin","screenTeacherRoom","screenStudentRoom"].forEach(s => ui[s].classList.add("hidden"));
  ui[id].classList.remove("hidden");
}

function randomCode(){
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({length: 6}, () => chars[Math.floor(Math.random()*chars.length)]).join("");
}
function uid(){
  return "u_" + Math.random().toString(36).slice(2,10);
}
function now(){ return Date.now(); }
function saveSession(data){
  localStorage.setItem("classroommafia_session", JSON.stringify(data));
  state.session = data;
}
function loadSession(){
  try { return JSON.parse(localStorage.getItem("classroommafia_session") || "null"); }
  catch { return null; }
}
function clearSession(){
  localStorage.removeItem("classroommafia_session");
  state.session = null;
}
function refs(roomCode){
  return {
    room: ref(db, `rooms/${roomCode}`),
    meta: ref(db, `rooms/${roomCode}/meta`),
    players: ref(db, `rooms/${roomCode}/players`),
    phase: ref(db, `rooms/${roomCode}/phase`),
    announcements: ref(db, `rooms/${roomCode}/announcements/current`),
    chats: (type) => ref(db, `rooms/${roomCode}/chats/${type}`),
    actions: ref(db, `rooms/${roomCode}/actions`),
  };
}

async function createRoom(){
  const teacherName = (ui.teacherName.value || "").trim() || "교사";
  const timerSeconds = Math.max(20, Math.min(300, Number(ui.defaultTimer.value || 60)));
  let roomCode = randomCode();
  const roomRef = ref(db, `rooms/${roomCode}`);

  const roleCounts = {};
  document.querySelectorAll("[data-role-count]").forEach(input => {
    roleCounts[input.dataset.roleCount] = Number(input.value || 0);
  });

  const teacherId = uid();
  const payload = {
    meta: {
      roomCode, hostId: teacherId, hostName: teacherName,
      status: "open", createdAt: Date.now(), defaultTimer: timerSeconds, roleCounts
    },
    phase: { name: "lobby", startedAt: Date.now(), endsAt: null, dayCount: 0, timerSeconds },
    announcements: { current: "학생들이 입장 중입니다." },
    players: {
      [teacherId]: {
        id: teacherId, name: teacherName, type: "teacher", online: true, connectedAt: Date.now(),
        lastSeen: Date.now(), alive: true, role: "teacher"
      }
    },
    actions: {},
    chats: { general: {}, mafia: {} },
    events: { updatedAt: Date.now() }
  };

  await set(roomRef, payload);
  saveSession({ role: "teacher", roomCode, userId: teacherId, name: teacherName });
  await setupPresence(roomCode, teacherId, true);
  bindRoomListeners(roomCode, "teacher", teacherId);
  show("screenTeacherRoom");
}

async function joinRoom(){
  const roomCode = (ui.studentRoomCode.value || "").trim().toUpperCase();
  const name = (ui.studentName.value || "").trim();
  if (!roomCode || !name) return alert("이름과 방 코드를 입력해 주세요.");
  const roomSnap = await get(ref(db, `rooms/${roomCode}/meta`));
  if (!roomSnap.exists()) return alert("방을 찾을 수 없어요.");
  if (roomSnap.val().status !== "open") return alert("이미 종료된 방입니다.");

  const userId = uid();
  const playerData = {
    id: userId, name, type: "student", online: true, connectedAt: now(), lastSeen: now(),
    alive: true, role: "", roleRevealedAt: null, shieldUsed: false
  };
  await set(ref(db, `rooms/${roomCode}/players/${userId}`), playerData);
  saveSession({ role: "student", roomCode, userId, name });
  await setupPresence(roomCode, userId, false);
  bindRoomListeners(roomCode, "student", userId);
  show("screenStudentRoom");
}

async function setupPresence(roomCode, userId, isTeacher){
  const playerRef = ref(db, `rooms/${roomCode}/players/${userId}`);
  await update(playerRef, { online: true, lastSeen: now() });
  onDisconnect(playerRef).update({ online: false, lastSeen: serverTimestamp() });

  clearInterval(state.heartbeat);
  state.heartbeat = setInterval(async () => {
    try {
      await update(playerRef, { online: true, lastSeen: now() });
      setConnPill(true);
    } catch (e) {
      setConnPill(false);
    }
  }, 15000);
}

function clearListeners(){
  state.listeners.forEach(unsub => {
    try { unsub(); } catch {}
  });
  state.listeners = [];
  clearInterval(state.heartbeat);
  clearInterval(state.countdown);
}

function bindRoomListeners(roomCode, role, userId){
  clearListeners();
  state.roomCode = roomCode;
  state.role = role;
  const R = refs(roomCode);

  const unsubRoom = onValue(R.room, snap => {
    const room = snap.val();
    if (!room || room.meta?.status === "closed") {
      if (role === "student") showOverlay("방 종료", "게임 종료", "교사가 방을 종료했습니다. 처음 화면으로 돌아갑니다.");
      clearSession();
      setTimeout(goHome, 900);
      return;
    }
    state.room = room;
    state.me = room.players?.[userId] || null;
    renderRoom();
  });
  state.listeners.push(unsubRoom);
}

function renderRoom(){
  if (!state.room) return;
  const room = state.room;
  const me = state.me;
  const phase = room.phase || {};
  const currentAnnouncement = room.announcements?.current || "공지 없음";

  updateCountdown(phase.endsAt);

  if (state.role === "teacher") {
    ui.teacherRoomCode.textContent = state.roomCode;
    ui.pillPhase.textContent = phaseLabel(phase.name);
    ui.teacherPhaseText.textContent = phaseLabel(phase.name);
    ui.teacherTimerText.textContent = phase.endsAt ? timeLeft(phase.endsAt) : "-";
    ui.pillConnection.textContent = "실시간 연결 중";
    renderTeacherPlayers(room.players || {});
    show("screenTeacherRoom");
  } else if (state.role === "student" && me) {
    ui.studentRoomCodeLabel.textContent = state.roomCode;
    ui.studentPhasePill.textContent = phaseLabel(phase.name);
    ui.studentConnPill.textContent = me.online ? "자동 복구 활성" : "복구 시도중";
    ui.meName.textContent = me.name || "-";
    ui.meRole.textContent = me.role ? (ROLE_INFO[me.role]?.label || me.role) : "미정";
    ui.meAlive.textContent = me.alive ? "생존" : "사망";
    ui.studentAnnouncement.textContent = currentAnnouncement;
    renderStudentActions(room, me);
    renderChats(room.chats?.general || {}, ui.chatList);
    renderChats(room.chats?.mafia || {}, ui.mafiaChatList);

    const showMafia = me.role === "mafia" && room.phase?.name === "night" && me.alive;
    ui.mafiaChatPanel.classList.toggle("hidden", !showMafia);
    show("screenStudentRoom");

    maybeShowRoleReveal(me);
    maybeShowDeathReveal(me, room);
  }
}

function renderTeacherPlayers(players){
  const arr = Object.values(players || {}).sort((a,b) => (a.type === "teacher" ? -1 : 1) || a.name.localeCompare(b.name));
  ui.teacherPlayers.innerHTML = "";
  arr.forEach(p => {
    const card = document.createElement("div");
    card.className = "player-card";
    card.innerHTML = `
      <div>
        <div><strong>${escapeHtml(p.name || "-")}</strong> ${p.type === "teacher" ? "👑" : ""}</div>
        <div class="player-meta">생존: ${p.alive ? "예" : "아니오"} · 마지막 갱신: ${formatTime(p.lastSeen)}</div>
      </div>
      <div class="badges">
        <span class="badge ${p.online ? "ok" : "off"}">${p.online ? "온라인" : "오프라인"}</span>
        <span class="badge role">${ROLE_INFO[p.role]?.label || p.role || "미정"}</span>
      </div>`;
    ui.teacherPlayers.appendChild(card);
  });
}

function renderStudentActions(room, me){
  const phase = room.phase?.name;
  const players = Object.values(room.players || {}).filter(p => p.type === "student");
  const aliveTargets = players.filter(p => p.alive);
  ui.studentActionArea.innerHTML = "";
  ui.studentActionHelp.textContent = "현재 단계와 역할에 따라 행동이 열립니다.";

  const addSelectAction = (title, actionKey, targets, disabled=false) => {
    const wrap = document.createElement("div");
    wrap.className = "info-box";
    const options = targets.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join("");
    wrap.innerHTML = `
      <strong>${title}</strong>
      <div class="chat-entry">
        <select id="sel_${actionKey}" ${disabled ? "disabled" : ""}>${options}</select>
        <button ${disabled ? "disabled" : ""} data-action-submit="${actionKey}">제출</button>
      </div>`;
    ui.studentActionArea.appendChild(wrap);
    wrap.querySelector("button")?.addEventListener("click", async () => {
      const targetId = wrap.querySelector("select").value;
      await submitAction(actionKey, targetId);
    });
  };

  if (!me.alive) {
    ui.studentActionArea.innerHTML = `<div class="notice">사망한 상태입니다. 관전만 가능합니다.</div>`;
    return;
  }

  if (phase === "night") {
    if (me.role === "mafia") addSelectAction("마피아 익명 투표", "mafiaKill", aliveTargets.filter(p => p.id !== me.id));
    if (me.role === "police") addSelectAction("경찰 조사", "policeCheck", aliveTargets.filter(p => p.id !== me.id));
    if (me.role === "doctor") addSelectAction("의사 보호", "doctorSave", aliveTargets);
    if (me.role === "thug") addSelectAction("건달 봉쇄", "thugBlock", aliveTargets.filter(p => p.id !== me.id));
    if (me.role === "terrorist") addSelectAction("테러 타겟 지정", "terrorTarget", aliveTargets.filter(p => p.id !== me.id));
    if (me.role === "shaman") {
      const deadTargets = players.filter(p => !p.alive);
      addSelectAction("영매 확인", "shamanCheck", deadTargets, deadTargets.length === 0);
    }
    if (me.role === "priest") {
      const deadTargets = players.filter(p => !p.alive);
      addSelectAction("성직자 부활(1회)", "priestRevive", deadTargets, deadTargets.length === 0 || me.usedPriest);
    }
    if (me.role === "reporter") {
      const dayCount = room.phase?.dayCount || 0;
      addSelectAction("기자 취재(2번째 밤부터, 1회)", "reporterReveal", aliveTargets.filter(p => p.id !== me.id), dayCount < 1 || me.usedReporter);
    }
  }

  if (phase === "day") {
    addSelectAction("낮 사형 투표", "dayVote", aliveTargets.filter(p => p.id !== me.id), me.blockedToday);
  }

  if (ui.studentActionArea.innerHTML.trim() === "") {
    ui.studentActionArea.innerHTML = `<div class="notice">현재 선택 가능한 행동이 없습니다.</div>`;
  }
}

async function submitAction(actionType, targetId){
  const { roomCode, userId } = state.session || {};
  if (!roomCode || !userId) return;
  const baseRef = ref(db, `rooms/${roomCode}/actions/${actionType}/${userId}`);
  await set(baseRef, { actorId: userId, targetId, at: now() });
  showOverlay("행동 제출", "선택 완료", "행동이 저장되었습니다.");
}

async function sendAnnouncement(){
  if (!state.roomCode) return;
  await set(ref(db, `rooms/${state.roomCode}/announcements/current`), ui.teacherAnnouncement.value || "");
  ui.teacherAnnouncement.value = "";
}

async function assignRoles(){
  if (!state.roomCode || !state.room) return;
  const players = Object.values(state.room.players || {}).filter(p => p.type === "student");
  if (players.length === 0) return alert("학생이 아직 없습니다.");

  const counts = state.room.meta?.roleCounts || DEFAULT_ROLE_COUNTS;
  const bag = [];
  Object.entries(counts).forEach(([role, count]) => {
    for (let i=0; i<Number(count||0); i++) bag.push(role);
  });
  while (bag.length < players.length) bag.push("citizen");
  shuffle(bag);

  const updates = {};
  players.forEach((p, idx) => {
    updates[`rooms/${state.roomCode}/players/${p.id}/role`] = bag[idx] || "citizen";
    updates[`rooms/${state.roomCode}/players/${p.id}/roleRevealedAt`] = now();
    updates[`rooms/${state.roomCode}/players/${p.id}/alive`] = true;
    updates[`rooms/${state.roomCode}/players/${p.id}/blockedToday`] = false;
    updates[`rooms/${state.roomCode}/players/${p.id}/usedReporter`] = false;
    updates[`rooms/${state.roomCode}/players/${p.id}/usedPriest`] = false;
    updates[`rooms/${state.roomCode}/players/${p.id}/shieldUsed`] = false;
  });
  updates[`rooms/${state.roomCode}/announcements/current`] = "역할이 배정되었습니다. 자신의 역할을 확인하세요.";
  await update(ref(db), updates);
  showOverlay("역할 배정", "완료", "학생들에게 역할이 배정되었습니다.");
}

async function startPhase(name){
  if (!state.roomCode || !state.room) return;
  const timerSeconds = state.room.meta?.defaultTimer || 60;
  const prevDayCount = state.room.phase?.dayCount || 0;
  const nextDayCount = name === "day" ? prevDayCount + 1 : prevDayCount;
  const updates = {
    [`rooms/${state.roomCode}/phase`]: {
      name, startedAt: now(), endsAt: now() + timerSeconds*1000, dayCount: nextDayCount, timerSeconds
    },
    [`rooms/${state.roomCode}/announcements/current`]: name === "night" ? "밤이 되었습니다. 각자 행동을 선택하세요." : "낮이 되었습니다. 토론과 투표를 진행하세요.",
    [`rooms/${state.roomCode}/actions/dayVote`]: null
  };
  // 낮 시작 시 건달 봉쇄 초기화
  if (name === "day") {
    Object.values(state.room.players || {}).forEach(p => {
      if (p.type === "student") updates[`rooms/${state.roomCode}/players/${p.id}/blockedToday`] = !!p.pendingBlocked;
      updates[`rooms/${state.roomCode}/players/${p.id}/pendingBlocked`] = false;
    });
  } else {
    // 밤 시작 시 밤 행동 저장소 초기화
    ["mafiaKill","policeCheck","doctorSave","thugBlock","terrorTarget","reporterReveal","shamanCheck","priestRevive"].forEach(k => {
      updates[`rooms/${state.roomCode}/actions/${k}`] = null;
    });
  }
  await update(ref(db), updates);
}

async function resolveNight(){
  if (!state.roomCode || !state.room) return;
  const room = state.room;
  const actions = room.actions || {};
  const players = room.players || {};
  const updates = {};
  let messages = [];

  // doctor save
  const savedTarget = firstTarget(actions.doctorSave);
  const blockedTarget = firstTarget(actions.thugBlock);
  if (blockedTarget) updates[`rooms/${state.roomCode}/players/${blockedTarget}/pendingBlocked`] = true;

  // police check (personal notice)
  const policeActor = firstActor(actions.policeCheck);
  const policeTarget = firstTarget(actions.policeCheck);
  if (policeActor && policeTarget && players[policeTarget]) {
    updates[`rooms/${state.roomCode}/players/${policeActor}/privateHint`] =
      `${players[policeTarget].name} 님은 ${players[policeTarget].role === "mafia" ? "마피아입니다." : "마피아가 아닙니다."}`;
  }

  // reporter
  const reporterActor = firstActor(actions.reporterReveal);
  const reporterTarget = firstTarget(actions.reporterReveal);
  if (reporterActor && reporterTarget && players[reporterTarget] && !players[reporterActor]?.usedReporter) {
    updates[`rooms/${state.roomCode}/players/${reporterActor}/usedReporter`] = true;
    updates[`rooms/${state.roomCode}/announcements/current`] = `기자 속보: ${players[reporterTarget].name} 님의 역할은 ${ROLE_INFO[players[reporterTarget].role]?.label || players[reporterTarget].role}입니다.`;
  }

  // shaman
  const shamanActor = firstActor(actions.shamanCheck);
  const shamanTarget = firstTarget(actions.shamanCheck);
  if (shamanActor && shamanTarget && players[shamanTarget]) {
    updates[`rooms/${state.roomCode}/players/${shamanActor}/privateHint`] =
      `${players[shamanTarget].name} 님의 직업은 ${ROLE_INFO[players[shamanTarget].role]?.label || players[shamanTarget].role}입니다.`;
  }

  // priest
  const priestActor = firstActor(actions.priestRevive);
  const priestTarget = firstTarget(actions.priestRevive);
  if (priestActor && priestTarget && players[priestTarget] && !players[priestActor]?.usedPriest) {
    updates[`rooms/${state.roomCode}/players/${priestTarget}/alive`] = true;
    updates[`rooms/${state.roomCode}/players/${priestActor}/usedPriest`] = true;
    updates[`rooms/${state.roomCode}/players/${priestTarget}/deathAt`] = null;
    messages.push(`${players[priestTarget].name} 님이 부활했습니다.`);
  }

  // mafia kill majority
  const mafiaTarget = majorityTarget(actions.mafiaKill);
  if (mafiaTarget && mafiaTarget !== savedTarget && players[mafiaTarget]?.alive) {
    const target = players[mafiaTarget];
    if (target.role === "soldier" && !target.shieldUsed) {
      updates[`rooms/${state.roomCode}/players/${mafiaTarget}/shieldUsed`] = true;
      updates[`rooms/${state.roomCode}/players/${mafiaTarget}/privateHint`] = "군인 능력 발동: 이번 공격을 버텼습니다. 마피아 중 한 명의 정체를 추적하세요.";
      messages.push(`${target.name} 님이 기적적으로 생존했습니다.`);
    } else {
      updates[`rooms/${state.roomCode}/players/${mafiaTarget}/alive`] = false;
      updates[`rooms/${state.roomCode}/players/${mafiaTarget}/deathAt`] = now();
      messages.push(`${target.name} 님이 밤의 희생자가 되었습니다.`);
    }
  } else {
    messages.push("이번 밤 희생자는 없었습니다.");
  }

  updates[`rooms/${state.roomCode}/announcements/current`] = messages.join(" ");
  await update(ref(db), updates);
  showOverlay("밤 결과 처리", "완료", messages.join(" "));
}

async function teacherLeaveRoom(){
  if (!state.roomCode) return goHome();
  if (!confirm("방을 종료하고 나가시겠어요? 학생들은 더 이상 접속할 수 없습니다.")) return;
  await update(ref(db, `rooms/${state.roomCode}/meta`), { status: "closed", closedAt: now() });
  await remove(ref(db, `rooms/${state.roomCode}/players/${state.session.userId}`));
  clearSession();
  goHome();
}

async function studentLeaveRoom(){
  if (!state.roomCode || !state.session?.userId) return goHome();
  await remove(ref(db, `rooms/${state.roomCode}/players/${state.session.userId}`));
  clearSession();
  goHome();
}

function goHome(){
  clearListeners();
  show("screenHome");
}

async function recoverSession(){
  const session = loadSession();
  if (!session?.roomCode || !session?.userId) return show("screenHome");
  try {
    const roomSnap = await get(ref(db, `rooms/${session.roomCode}`));
    if (!roomSnap.exists()) {
      clearSession();
      return show("screenHome");
    }
    const room = roomSnap.val();
    if (room.meta?.status === "closed") {
      clearSession();
      return show("screenHome");
    }
    const playerSnap = await get(ref(db, `rooms/${session.roomCode}/players/${session.userId}`));
    if (!playerSnap.exists()) {
      // student reconnect recreation
      if (session.role === "student") {
        await set(ref(db, `rooms/${session.roomCode}/players/${session.userId}`), {
          id: session.userId, name: session.name || "학생", type: "student",
          online: true, connectedAt: now(), lastSeen: now(), alive: true, role: ""
        });
      } else {
        clearSession();
        return show("screenHome");
      }
    } else {
      await update(ref(db, `rooms/${session.roomCode}/players/${session.userId}`), {
        online: true, lastSeen: now()
      });
    }
    await setupPresence(session.roomCode, session.userId, session.role === "teacher");
    bindRoomListeners(session.roomCode, session.role, session.userId);
    show(session.role === "teacher" ? "screenTeacherRoom" : "screenStudentRoom");
  } catch (e) {
    console.error(e);
    setConnPill(false);
  }
}

function renderChats(obj, root){
  const entries = Object.values(obj || {}).sort((a,b) => (a.at||0) - (b.at||0)).slice(-40);
  root.innerHTML = entries.map(item => `
    <div class="chat-msg">
      <div class="meta">${escapeHtml(item.name || "익명")} · ${formatTime(item.at)}</div>
      <div>${escapeHtml(item.message || "")}</div>
    </div>`).join("");
  root.scrollTop = root.scrollHeight;
}

async function sendChat(type){
  if (!state.roomCode || !state.me) return;
  const input = type === "mafia" ? ui.mafiaChatInput : ui.chatInput;
  const message = (input.value || "").trim();
  if (!message) return;
  const chatRef = push(ref(db, `rooms/${state.roomCode}/chats/${type}`));
  await set(chatRef, { name: state.me.name, userId: state.me.id, message, at: now() });
  input.value = "";
}

function maybeShowRoleReveal(me){
  if (!me.role || !me.roleRevealedAt) return;
  const key = `role_${me.id}_${me.roleRevealedAt}`;
  if (state.lastOverlayKey === key) return;
  if (sessionStorage.getItem(key)) return;
  sessionStorage.setItem(key, "1");
  state.lastOverlayKey = key;
  showOverlay("역할 공개", ROLE_INFO[me.role]?.label || me.role, ROLE_INFO[me.role]?.desc || "");
}

function maybeShowDeathReveal(me, room){
  if (me.alive || !me.deathAt) return;
  const key = `death_${me.id}_${me.deathAt}`;
  if (sessionStorage.getItem(key)) return;
  sessionStorage.setItem(key, "1");
  showOverlay("사망", "당신은 죽었습니다", "이제 관전 모드로 전환됩니다.");
}

function showMyRole(){
  if (!state.me?.role) return alert("아직 역할이 배정되지 않았어요.");
  showOverlay("내 역할", ROLE_INFO[state.me.role]?.label || state.me.role, ROLE_INFO[state.me.role]?.desc || "");
}

function showOverlay(eyebrow, title, body){
  ui.overlayEyebrow.textContent = eyebrow;
  ui.overlayTitle.textContent = title;
  ui.overlayBody.textContent = body;
  ui.overlay.classList.remove("hidden");
}
function hideOverlay(){ ui.overlay.classList.add("hidden"); }

function phaseLabel(name){
  return ({lobby:"대기", day:"낮", night:"밤"})[name] || "대기";
}
function updateCountdown(endsAt){
  clearInterval(state.countdown);
  const tick = () => {
    const txt = endsAt ? timeLeft(endsAt) : "-";
    if (ui.teacherTimerText) ui.teacherTimerText.textContent = txt;
  };
  tick();
  if (!endsAt) return;
  state.countdown = setInterval(tick, 1000);
}
function timeLeft(ts){
  const diff = Math.max(0, Math.floor((ts - Date.now())/1000));
  const m = String(Math.floor(diff/60)).padStart(2,"0");
  const s = String(diff%60).padStart(2,"0");
  return `${m}:${s}`;
}
function firstTarget(obj){
  const arr = Object.values(obj || {});
  return arr[0]?.targetId || null;
}
function firstActor(obj){
  const arr = Object.values(obj || {});
  return arr[0]?.actorId || null;
}
function majorityTarget(obj){
  const arr = Object.values(obj || {});
  if (!arr.length) return null;
  const count = {};
  arr.forEach(x => count[x.targetId] = (count[x.targetId] || 0) + 1);
  let max = 0;
  let candidates = [];
  Object.entries(count).forEach(([target, c]) => {
    if (c > max) { max = c; candidates = [target]; }
    else if (c === max) candidates.push(target);
  });
  return candidates[Math.floor(Math.random() * candidates.length)];
}
function shuffle(arr){
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
function formatTime(t){
  if (!t) return "-";
  const d = new Date(t);
  return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}:${String(d.getSeconds()).padStart(2,"0")}`;
}
function setConnPill(ok){
  const txt = ok ? "실시간 연결 중" : "연결 불안정";
  if (ui.pillConnection) ui.pillConnection.textContent = txt;
  if (ui.studentConnPill) ui.studentConnPill.textContent = ok ? "자동 복구 활성" : "복구 시도중";
}
function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}
function playClickSound(){
  try{
    const ctx = state.audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    state.audioCtx = ctx;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(70, now + 0.18);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.06, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.24);
  } catch(e) {}
}
