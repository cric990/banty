// CONFIG (PASTE KEYS)
const firebaseConfig = {
  apiKey: "AIzaSyA2iHrUt8_xxvB2m8-LftaE9sg_5JaiFk8",
  authDomain: "banty-live.firebaseapp.com",
  projectId: "banty-live",
  storageBucket: "banty-live.firebasestorage.app",
  messagingSenderId: "435477036444",
  appId: "1:435477036444:web:207931e07ea52ca3269c59",
  measurementId: "G-HXMVFK1E1C"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// --- 1. SEARCH ---
function toggleSearch() {
    const s = document.getElementById('search-ui');
    s.classList.toggle('active');
    if(s.classList.contains('active')) document.getElementById('search-inp').focus();
    else renderGrid(allData);
}
document.getElementById('search-inp').addEventListener('input', (e) => {
    const val = e.target.value.toLowerCase();
    const filtered = allData.filter(d => d.title.toLowerCase().includes(val));
    renderGrid(filtered);
});

// --- 2. DYNAMIC ISLAND ---
const notifSound = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3");
let islandUrl = "";

db.collection("island_alerts").orderBy("time", "desc").limit(1).onSnapshot(snap => {
    snap.docChanges().forEach(c => {
        if(c.type === 'added' && Date.now() - c.doc.data().time < 10000) {
            triggerIsland(c.doc.data());
        }
    });
});

function triggerIsland(d) {
    const el = document.getElementById('island-wrap');
    document.getElementById('di-title').innerText = d.title;
    document.getElementById('di-msg').innerText = d.msg;
    document.getElementById('di-img').src = d.img || 'https://via.placeholder.com/50';
    islandUrl = d.link;
    el.classList.add('active');
    notifSound.play().catch(()=>{});
    setTimeout(() => el.classList.remove('active'), 6000);
}
function expandIsland() { if(islandUrl) window.location.href = islandUrl; }

// --- 3. WHATSAPP ---
function showWa() {
    const t = document.getElementById('wa-popup');
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 5000);
}
setInterval(showWa, 1500000);
setTimeout(showWa, 15000);

// --- 4. DATA LOGIC ---
let allData = [];
let curCat = 'All';

// Cats
db.collection("categories").onSnapshot(s => {
    const t = document.getElementById('cat-tabs');
    t.innerHTML = `<div class="tab-pill active" onclick="filterCat('All', this)">All Events</div>`;
    s.forEach(d => {
        const n = d.data().name;
        t.innerHTML += `<div class="tab-pill" onclick="filterCat('${n}', this)">${n}</div>`;
    });
});

function filterCat(c, btn) {
    curCat = c;
    document.querySelectorAll('.tab-pill').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderGrid(c === 'All' ? allData : allData.filter(d => d.category === c));
}

// Matches
db.collection("matches").orderBy("time", "desc").onSnapshot(s => {
    allData = [];
    s.forEach(doc => allData.push(doc.data()));
    if(!document.getElementById('search-ui').classList.contains('active')) renderGrid(allData);
});

function renderGrid(data) {
    const g = document.getElementById('grid');
    g.innerHTML = "";
    if(data.length === 0) { g.innerHTML = '<p style="padding:20px; color:gray;">No matches found.</p>'; return; }

    data.forEach(d => {
        const div = document.createElement('div');
        div.className = 'match-card';
        div.onclick = () => openPlayer(d);
        div.innerHTML = `
            <div class="poster-wrap">
                <img src="${d.poster}" class="poster-img" onerror="this.src='https://via.placeholder.com/300x160'">
                <div class="card-overlay-badge">HD</div>
            </div>
            <div class="card-content">
                <div class="card-title">${d.title}</div>
                <div class="card-meta">
                    <div class="live-status"><div class="live-beacon"></div> LIVE</div>
                    <div>${d.streams ? d.streams.length : 1} Src</div>
                </div>
            </div>`;
        g.appendChild(div);
    });
}

// Slider
const slider = document.getElementById('slider');
db.collection("slider").orderBy("time", "desc").onSnapshot(s => {
    slider.innerHTML = "";
    s.forEach(d => {
        const div = document.createElement('div');
        div.className = 'hero-card';
        div.style.backgroundImage = `url('${d.data().img}')`;
        if(d.data().link) div.onclick = () => openPlayer({title:d.data().title, streams:[{lbl:'HD', url:d.data().link}]});
        div.innerHTML = `<div class="hero-overlay"><span class="hero-badge">HOT</span><div class="hero-title">${d.data().title}</div></div>`;
        slider.appendChild(div);
    });
});

// --- 5. CLAPPR PLAYER ENGINE ---
let playerInstance = null;
let viewInt;

function openPlayer(d) {
    document.getElementById('player-ui').classList.add('active');
    document.getElementById('p-title').innerText = d.title;
    
    const qBox = document.getElementById('q-btns');
    qBox.innerHTML = "";

    if(d.streams && d.streams.length > 0) {
        playStream(d.streams[0], d.useProxy);

        d.streams.forEach((s, i) => {
            let b = document.createElement('div');
            b.className = i===0 ? 'pm-btn active' : 'pm-btn';
            b.innerText = s.lbl;
            b.onclick = () => {
                document.querySelectorAll('.pm-btn').forEach(x=>x.classList.remove('active'));
                b.classList.add('active');
                playStream(s, d.useProxy);
            }
            qBox.appendChild(b);
        });
    }

    clearInterval(viewInt);
    const min = parseInt(d.minViews) || 1000;
    const max = parseInt(d.maxViews) || 2000;
    updateView(min, max);
    viewInt = setInterval(() => updateView(min, max), 3000);
}

function playStream(s, useProxy) {
    // DESTROY OLD
    if(playerInstance) { playerInstance.destroy(); playerInstance = null; }
    document.getElementById('player-container').innerHTML = "";
    
    const iframe = document.getElementById('web-player');
    const playerBox = document.getElementById('player-container');

    iframe.src = "";
    iframe.style.display = 'none';
    playerBox.style.display = 'none';

    let finalUrl = s.url;
    if(useProxy) {
        // Use a CORS proxy if selected in admin
        finalUrl = 'https://corsproxy.io/?' + encodeURIComponent(s.url);
    }

    if(s.type === 'embed') {
        iframe.style.display = 'block';
        iframe.src = s.url;
    } else {
        playerBox.style.display = 'block';
        playerInstance = new Clappr.Player({
            source: finalUrl,
            parentId: "#player-container",
            width: '100%',
            height: '100%',
            autoPlay: true,
            playback: {
                hlsjsConfig: {
                    xhrSetup: function(xhr, url) {
                        xhr.withCredentials = false; // Important
                    }
                }
            }
        });
    }
}

function updateView(min, max) {
    const v = Math.floor(Math.random() * (max - min + 1) + min);
    document.getElementById('view-cnt').innerText = v.toLocaleString();
}

function closePlayer() {
    if(playerInstance) { playerInstance.destroy(); playerInstance = null; }
    document.getElementById('web-player').src = "";
    document.getElementById('player-ui').classList.remove('active');
    clearInterval(viewInt);
}

// --- 6. NOTIFICATIONS ---
function toggleNotif() {
    document.getElementById('n-menu').classList.toggle('active');
    document.getElementById('n-badge').style.display = 'none';
}

db.collection("notifications").orderBy("time", "desc").onSnapshot(s => {
    const list = document.getElementById('n-list');
    list.innerHTML = "";
    let count = 0;
    const now = Date.now();
    const limit = 3600000;

    s.forEach(d => {
        const data = d.data();
        if(now - data.time < limit) {
            count++;
            const min = Math.floor((now - data.time)/60000);
            list.innerHTML += `
                <div class="np-item">
                    <div class="np-title">${data.title}</div>
                    <div class="np-msg">${data.msg}</div>
                    <span class="np-time">${min}m ago</span>
                </div>`;
        }
    });

    if(count === 0) list.innerHTML = '<div style="padding:20px;text-align:center;color:gray;">No alerts</div>';
    if(count > 0) {
        document.getElementById('n-badge').style.display = 'block';
    }
});

// THEME
function toggleTheme() {
    const b = document.body;
    const i = document.getElementById('theme-icon');
    if(b.getAttribute('data-theme')==='light') {
        b.removeAttribute('data-theme'); localStorage.setItem('theme','dark'); i.classList.remove('fa-moon'); i.classList.add('fa-sun');
    } else {
        b.setAttribute('data-theme','light'); localStorage.setItem('theme','light'); i.classList.remove('fa-sun'); i.classList.add('fa-moon');
    }
}
if(localStorage.getItem('theme')==='light') toggleTheme();