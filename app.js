// --- CONFIG (PASTE YOUR FIREBASE CONFIG) ---
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

// --- 1. SEARCH LOGIC ---
function toggleSearch() {
    const s = document.getElementById('search-ui');
    s.classList.toggle('active');
    if(s.classList.contains('active')) {
        document.getElementById('search-inp').value = "";
        document.getElementById('search-inp').focus();
    } else {
        renderGrid(allData);
    }
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

// --- 3. WHATSAPP TOAST ---
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

// Categories
db.collection("categories").onSnapshot(s => {
    const t = document.getElementById('cat-tabs');
    t.innerHTML = `<div class="tab active" onclick="filter('All', this)">All Events</div>`;
    s.forEach(d => {
        const n = d.data().name;
        t.innerHTML += `<div class="tab" onclick="filter('${n}', this)">${n}</div>`;
    });
});

function filter(c, btn) {
    curCat = c;
    document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('grid-head').innerText = c + " Matches";
    renderGrid(curCat === 'All' ? allData : allData.filter(d => d.category === c));
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
        div.className = 'card';
        div.onclick = () => openPlayer(d);
        div.innerHTML = `
            <img src="${d.poster}" class="poster" onerror="this.src='https://via.placeholder.com/300x160'">
            <div class="c-content">
                <div class="c-title">${d.title}</div>
                <div class="c-ft">
                    <span class="live-txt">● LIVE</span>
                    <span>${d.streams ? d.streams.length : 1} Source</span>
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
        div.className = 'slide';
        div.style.backgroundImage = `url('${d.data().img}')`;
        if(d.data().link) div.onclick = () => openPlayer({title:d.data().title, streams:[{lbl:'HD', url:d.data().link, type:'m3u8'}]});
        div.innerHTML = `<div class="slide-overlay"><span class="slide-badge">HOT</span><div class="slide-title">${d.data().title}</div></div>`;
        slider.appendChild(div);
    });
});

// --- 5. PLAYER ENGINE (THE FIX) ---
var player = videojs('v-player', {
    fluid: true,
    html5: {
        vhs: { 
            overrideNative: true,
            withCredentials: false
        },
        nativeAudioTracks: false,
        nativeVideoTracks: false
    }
});

let viewInt;

// Error Handling with Proxy Retry
player.on('error', function() {
    const error = player.error();
    const currentSrc = player.src();
    
    // If error is network related and not already using proxy
    if ((error.code === 2 || error.code === 4) && !currentSrc.includes('corsproxy.io')) {
        console.log("Direct play failed. Attempting CORS Proxy...");
        const proxyUrl = 'https://corsproxy.io/?' + encodeURIComponent(currentSrc);
        
        player.error(null); // Clear error
        player.src({ src: proxyUrl, type: 'application/x-mpegURL' });
        player.play().catch(e => console.log("Proxy Autoplay blocked"));
    }
});

function openPlayer(d) {
    document.getElementById('player-ui').classList.add('active');
    document.getElementById('p-title').innerText = d.title;
    
    const qBox = document.getElementById('q-btns');
    qBox.innerHTML = "";

    if(d.streams && d.streams.length > 0) {
        switchSource(d.streams[0]);

        d.streams.forEach((s, i) => {
            let b = document.createElement('div');
            b.className = i===0 ? 'btn-q active' : 'btn-q';
            b.innerText = s.lbl;
            b.onclick = () => {
                document.querySelectorAll('.btn-q').forEach(x=>x.classList.remove('active'));
                b.classList.add('active');
                switchSource(s);
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

function switchSource(s) {
    const v = document.getElementById('v-player');
    const w = document.getElementById('web-player');
    const vjs = document.querySelector('.video-js');

    player.pause();
    w.src = "";

    if(s.type === 'embed') {
        vjs.style.display = 'none';
        w.style.display = 'block';
        w.src = s.url;
    } else {
        w.style.display = 'none';
        vjs.style.display = 'block';
        
        // Reset Error State
        player.error(null);
        
        // Try Direct First
        player.src({ src: s.url, type: 'application/x-mpegURL' });
        player.play().catch(e => console.log("Auto-play prevented"));
    }
}

function updateView(min, max) {
    const v = Math.floor(Math.random() * (max - min + 1) + min);
    document.getElementById('view-cnt').innerText = v.toLocaleString();
}

function closePlayer() {
    player.pause();
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
    const limit = 3600000; // 1 Hour

    s.forEach(d => {
        const data = d.data();
        if(now - data.time < limit) {
            count++;
            const min = Math.floor((now - data.time)/60000);
            list.innerHTML += `
                <div class="n-item">
                    <h4>${data.title}</h4>
                    <p>${data.msg}</p>
                    <span>${min} mins ago</span>
                </div>`;
        }
    });

    if(count === 0) list.innerHTML = '<div style="padding:20px;text-align:center;color:gray;">No alerts</div>';
    if(count > 0) {
        const b = document.getElementById('n-badge');
        b.style.display = 'flex';
        b.innerText = count;
    }
});
