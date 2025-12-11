// CONFIG (Same as App)
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

// AUTH
function login() {
    if(document.getElementById('pass').value === "admin123") {
        document.getElementById('login-scr').style.display = 'none';
        loadAdmin();
    } else alert("Wrong Password");
}

// 1. CATEGORY
function addCat() {
    const n = document.getElementById('c-name').value;
    if(n) db.collection("categories").add({name:n}).then(()=>{ alert("Added"); document.getElementById('c-name').value=""; });
}

// 2. MATCH
function addLinkField(type='m3u8', lbl='', url='') {
    const d = document.createElement('div');
    d.className = 'l-row';
    d.style = "display:flex; gap:10px; margin-bottom:10px;";
    d.innerHTML = `<select class="inp q-type" style="width:25%;margin:0;padding:10px;"><option value="m3u8" ${type==='m3u8'?'selected':''}>M3U8</option><option value="embed" ${type==='embed'?'selected':''}>Embed</option></select><input type="text" class="inp q-lbl" value="${lbl}" placeholder="Label" style="width:20%;margin:0;"><input type="text" class="inp q-url" value="${url}" placeholder="Link" style="flex:1;margin:0;"><button onclick="this.parentElement.remove()" style="color:red;background:none;border:none;">X</button>`;
    document.getElementById('links-wrap').appendChild(d);
}

function pubMatch() {
    const id = document.getElementById('edit-id').value;
    const cat = document.getElementById('m-cat').value;
    const title = document.getElementById('m-title').value;
    const poster = document.getElementById('m-poster').value;
    const min = document.getElementById('v-min').value || 1000;
    const max = document.getElementById('v-max').value || 2000;
    const proxy = document.getElementById('use-proxy').checked;

    if(cat === 'All') return alert("Select Category");

    let streams = [];
    document.querySelectorAll('.l-row').forEach(r => {
        const t = r.querySelector('.q-type').value;
        const l = r.querySelector('.q-lbl').value;
        const u = r.querySelector('.q-url').value;
        if(u) streams.push({type: t, lbl: l, url: u});
    });

    const data = { category: cat, title: title, poster: poster, minViews: min, maxViews: max, streams: streams, useProxy: proxy, time: Date.now() };

    if(id) {
        db.collection("matches").doc(id).update(data).then(() => { alert("Updated"); resetForm(); });
    } else {
        db.collection("matches").add(data).then(() => { alert("Published"); resetForm(); });
    }
}

window.editMatch = function(id, t, p, min, max, c, proxy, sStr) {
    window.scrollTo({top:0, behavior:'smooth'});
    document.getElementById('form-head').innerText = "Edit Stream";
    document.getElementById('pub-btn').innerText = "UPDATE";
    document.getElementById('edit-id').value = id;
    document.getElementById('m-title').value = t;
    document.getElementById('m-poster').value = p;
    document.getElementById('v-min').value = min;
    document.getElementById('v-max').value = max;
    document.getElementById('m-cat').value = c;
    document.getElementById('use-proxy').checked = proxy;
    document.getElementById('links-wrap').innerHTML = '<div style="font-size:11px;color:gray;margin-bottom:5px;">SOURCES</div>';
    JSON.parse(decodeURIComponent(sStr)).forEach(s => addLinkField(s.type, s.lbl, s.url));
};

function resetForm() {
    document.getElementById('edit-id').value = "";
    document.getElementById('form-head').innerText = "Create Stream";
    document.getElementById('pub-btn').innerText = "GO LIVE";
    document.getElementById('m-title').value = "";
    document.getElementById('m-poster').value = "";
    document.getElementById('use-proxy').checked = false;
    document.getElementById('links-wrap').innerHTML = '<div style="font-size:11px;color:gray;margin-bottom:5px;">SOURCES</div>';
    addLinkField();
}

// 3. SLIDER & NOTIF
function addSlide() {
    db.collection("slider").add({ title: document.getElementById('sl-title').value, img: document.getElementById('sl-img').value, link: document.getElementById('sl-link').value, time: Date.now() }).then(()=>alert("Added"));
}
function sendIsland() {
    db.collection("island_alerts").add({ title: document.getElementById('n-title').value, msg: document.getElementById('n-msg').value, img: document.getElementById('n-img').value, link: document.getElementById('n-link').value, time: Date.now() }).then(()=>alert("Sent"));
}

// LOAD
function loadAdmin() {
    db.collection("categories").onSnapshot(s => {
        const sel = document.getElementById('m-cat');
        const lst = document.getElementById('cat-list');
        sel.innerHTML = '<option value="All">Select Category</option>';
        lst.innerHTML = "";
        s.forEach(d => {
            const n = d.data().name;
            sel.innerHTML += `<option value="${n}">${n}</option>`;
            lst.innerHTML += `<button class="btn-del" onclick="db.collection('categories').doc('${d.id}').delete()">${n} ×</button>`;
        });
    });
    db.collection("slider").onSnapshot(s => {
        const l = document.getElementById('slide-list'); l.innerHTML="";
        s.forEach(d => l.innerHTML += `<div style="color:white;margin-bottom:5px;border-bottom:1px solid #333;">${d.data().title} <button onclick="db.collection('slider').doc('${d.id}').delete()" style="color:red;background:none;border:none;">DEL</button></div>`);
    });
    db.collection("matches").orderBy("time", "desc").onSnapshot(s => {
        const l = document.getElementById('stream-list'); l.innerHTML = "";
        s.forEach(d => {
            const data = d.data();
            const str = encodeURIComponent(JSON.stringify(data.streams));
            l.innerHTML += `
                <div style="background:var(--bg-card); padding:10px; border:1px solid #333; margin-bottom:5px; display:flex; justify-content:space-between; align-items:center; color:white;">
                    <span>${data.title}</span>
                    <div>
                        <button class="btn" style="background:#ffaa00; width:auto; padding:5px 10px; font-size:10px;" onclick="editMatch('${d.id}', '${data.title}', '${data.poster}', '${data.minViews}', '${data.maxViews}', '${data.category}', ${data.useProxy}, '${str}')">EDIT</button>
                        <button class="btn" style="background:var(--accent); width:auto; padding:5px 10px; font-size:10px;" onclick="db.collection('matches').doc('${d.id}').delete()">DEL</button>
                    </div>
                </div>`;
        });
    });
}