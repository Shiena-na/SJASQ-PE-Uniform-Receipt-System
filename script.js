/* ===================== PRICE CATALOG (from SJASQ PE & Uniform delivery records) ===================== */
const CATALOG = {
  "Elementary": {
    "T-Shirt": {XS:165,S:165,M:175,L:175,XL:195,"2XL":195,"3XL":220,"4XL":245,"5XL":245,"6XL":245},
    "Jogging Pants": {XS:330,S:330,M:345,L:345,XL:360,"2XL":360,"3XL":375,"4XL":375,"5XL":390,"6XL":390}
  },
  "Junior High School": {
    "T-Shirt": {XS:185,S:185,M:200,L:200,XL:215,"2XL":215,"3XL":230,"4XL":230,"5XL":240,"6XL":240},
    "Jogging Pants": {XS:350,S:350,M:365,L:365,XL:385,"2XL":385,"3XL":400,"4XL":400,"5XL":400,"6XL":415}
  },
  "Senior High School": {
    "T-Shirt": {XS:205,S:205,M:220,L:220,XL:230,"2XL":230,"3XL":245,"4XL":245,"5XL":255,"6XL":255},
    "Jogging Pants": {XS:285,S:285,M:300,L:300,XL:320,"2XL":320,"3XL":335,"4XL":325,"5XL":325,"6XL":350}
  },
  "Jacket": {
    "Jacket": {"Kids":350,"Adult":350}
  },
  "Special Order": {
    "T-Shirt": {"Standard":200}
  },
  "Accessories": {
    "Tote Bag": {"Standard":110}
  }
};

/* ===================== STATE ===================== */
let cart = [];
let currentId = null; // history id when reprinting a saved receipt

/* ===================== HELPERS ===================== */
const $ = id => document.getElementById(id);
const peso = n => "₱" + (Number(n)||0).toLocaleString('en-PH', {minimumFractionDigits:2, maximumFractionDigits:2});
function todayISO(){ return new Date().toISOString().slice(0,10); }
function fmtDate(iso){
  if(!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString('en-PH', {year:'numeric', month:'short', day:'numeric'});
}
function toast(msg){
  const t = $('toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(()=>t.classList.remove('show'), 2200);
}
// Receipt No. = SJ-<year>-<sequence>, where <sequence> is which resibo number
// this is for that year (based on how many receipts already exist for the
// current year in saved history). Falls back to a random number if
// storage can't be read.
async function genReceiptNo(){
  const year = new Date().getFullYear();
  let count = 0;
  try{
    const res = await window.storage.list('receipt:', false);
    const keys = (res && res.keys) ? res.keys : [];
    for(const k of keys){
      try{
        const r = await window.storage.get(k, false);
        if(r){
          const rec = JSON.parse(r.value);
          if(rec.receiptNo && rec.receiptNo.startsWith("SJ-" + year + "-")) count++;
        }
      }catch(e){ /* skip unreadable record */ }
    }
  }catch(e){
    // storage unavailable — fall back to a random sequence
    count = Math.floor(Math.random()*9000) + 999;
  }
  const seq = String(count).padStart(4,'0');
  return "SJ-" + year + "-" + seq;
}

/* ===================== FORM: LEVEL / ITEM CASCADE -> SIZE GRID (like the sheet) ===================== */
function populateSelect(sel, options){
  sel.innerHTML = options.map(o => `<option value="${o}">${o}</option>`).join('');
}
function refreshLevels(){
  populateSelect($('selLevel'), Object.keys(CATALOG));
  refreshItems();
}
function refreshItems(){
  const level = $('selLevel').value;
  populateSelect($('selItem'), Object.keys(CATALOG[level]));
  buildSizeGrid();
}
$('selLevel').addEventListener('change', refreshItems);
$('selItem').addEventListener('change', buildSizeGrid);

// Builds a SIZE / PRICE / QTY / AMOUNT grid for the chosen level+item, mirroring the sheet's layout.
// Price is always pulled automatically — there is no manual price entry.
function buildSizeGrid(){
  const level = $('selLevel').value, item = $('selItem').value;
  const sizes = CATALOG[level][item];
  const body = $('sizeGridBody');
  body.innerHTML = Object.entries(sizes).map(([size, price]) => `
    <tr data-size="${size}">
      <td>${size}</td>
      <td class="num">${peso(price)}</td>
      <td class="num"><input type="number" class="qtyInput" data-size="${size}" data-price="${price}" value="0" min="0"></td>
      <td class="num amt" data-size="${size}">${peso(0)}</td>
    </tr>
  `).join('');
  body.querySelectorAll('.qtyInput').forEach(inp => inp.addEventListener('input', updateGridTotals));
  updateGridTotals();
}

function updateGridTotals(){
  let qtyTotal = 0, amtTotal = 0;
  document.querySelectorAll('#sizeGridBody .qtyInput').forEach(inp => {
    const qty = Math.max(0, parseInt(inp.value) || 0);
    const price = parseFloat(inp.dataset.price) || 0;
    const amt = qty * price;
    qtyTotal += qty; amtTotal += amt;
    const cell = document.querySelector(`#sizeGridBody .amt[data-size="${inp.dataset.size}"]`);
    if(cell) cell.textContent = peso(amt);
  });
  $('gridQtyTotal').textContent = qtyTotal;
  $('gridAmtTotal').textContent = peso(amtTotal);
}

/* ===================== CART ===================== */
$('addItemBtn').addEventListener('click', () => {
  const level = $('selLevel').value, item = $('selItem').value;
  let added = 0;
  document.querySelectorAll('#sizeGridBody .qtyInput').forEach(inp => {
    const qty = Math.max(0, parseInt(inp.value) || 0);
    if(qty > 0){
      const size = inp.dataset.size;
      const price = parseFloat(inp.dataset.price) || 0;
      cart.push({ level, item, size, qty, price });
      inp.value = 0;
      added++;
    }
  });
  if(added === 0){
    toast("Enter a quantity for at least one size");
    return;
  }
  updateGridTotals();
  render();
  toast(added === 1 ? "1 size added" : added + " sizes added");
});

function removeItem(idx){
  cart.splice(idx,1);
  render();
}

/* ===================== RENDER ===================== */
function render(){
  // ---- shop header ----
  $('rShopName').textContent = $('shopName').value || "Tailoring Shop";
  $('rAddress').textContent = $('shopAddress').value;
  $('rContact').textContent = $('shopContact').value;

  // ---- meta ----
  $('pReceiptNo').textContent = $('receiptNo').value || "—";
  $('pDeliveryDate').textContent = fmtDate($('deliveryDate').value);
  $('pClaimDate').textContent = fmtDate($('claimDate').value);

  // ---- cart list (editor) ----
  const cartList = $('cartList');
  if(cart.length === 0){
    cartList.innerHTML = '<div class="cart-empty">No items added yet.</div>';
  } else {
    cartList.innerHTML = cart.map((c,i) => `
      <div class="cart-row">
        <div class="desc">${c.item} — ${c.size}<small>${c.level} · Qty ${c.qty} × ${peso(c.price)}</small></div>
        <div class="amt">${peso(c.qty*c.price)}</div>
        <div></div>
        <button class="x-btn" onclick="removeItem(${i})" title="Remove">✕</button>
      </div>
    `).join('');
  }

  // ---- receipt items table ----
  const pItems = $('pItems');
  if(cart.length === 0){
    pItems.innerHTML = '';
  } else {
    pItems.innerHTML = cart.map(c => `
      <tr>
        <td><span class="item-name">${c.item}</span><span class="item-sub">${c.level} · Size ${c.size}</span></td>
        <td class="num">${c.qty}</td>
        <td class="num">${peso(c.price)}</td>
        <td class="num">${peso(c.qty*c.price)}</td>
      </tr>
    `).join('');
  }

  // ---- totals ----
  const total = cart.reduce((s,c)=> s + c.qty*c.price, 0);
  $('pTotal').textContent = peso(total);
}

// live-update on any relevant input change
['receiptNo','deliveryDate','claimDate',
 'shopName','shopTagline','shopAddress','shopContact'].forEach(id=>{
  $(id).addEventListener('input', render);
  $(id).addEventListener('change', render);
});

/* ===================== NEW / RESET ===================== */
$('clearBtn').addEventListener('click', async () => {
  if(cart.length && !confirm("Start a new receipt? Unsaved items will be cleared.")) return;
  cart = [];
  currentId = null;
  $('receiptNo').value = await genReceiptNo();
  $('deliveryDate').value = todayISO();
  $('claimDate').value = '';
  render();
  toast("New receipt started");
});

/* ===================== PRINT ===================== */
$('printBtn').addEventListener('click', () => window.print());

/* ===================== PDF DOWNLOAD ===================== */
$('pdfBtn').addEventListener('click', async () => {
  const btn = $('pdfBtn'); const original = btn.textContent;
  btn.textContent = "Generating..."; btn.disabled = true;
  try{
    const node = $('receipt');
    const canvas = await html2canvas(node, {scale:3, backgroundColor:"#FBF7EE"});
    const imgData = canvas.toDataURL('image/png');
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ unit:'pt', format:'a4' });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const imgW = pageW - 60;
    const imgH = imgW * (canvas.height / canvas.width);
    let y = 30;
    if(imgH > pageH - 60){
      // scale to fit height instead
      const scaledH = pageH - 60;
      const scaledW = scaledH * (canvas.width / canvas.height);
      pdf.addImage(imgData, 'PNG', (pageW-scaledW)/2, 30, scaledW, scaledH);
    } else {
      pdf.addImage(imgData, 'PNG', 30, y, imgW, imgH);
    }
    const fname = ($('receiptNo').value || "receipt") + ".pdf";
    pdf.save(fname);
    toast("PDF downloaded");
  } catch(e){
    console.error(e);
    toast("Could not generate PDF");
  } finally {
    btn.textContent = original; btn.disabled = false;
  }
});

/* ===================== SAVE / HISTORY (persistent storage) ===================== */
async function saveReceipt(){
  const total = cart.reduce((s,c)=> s + c.qty*c.price, 0);
  const id = currentId || (Date.now().toString(36) + Math.random().toString(36).slice(2,6));
  currentId = id;

  const record = {
    id,
    receiptNo: $('receiptNo').value || await genReceiptNo(),
    deliveryDate: $('deliveryDate').value,
    claimDate: $('claimDate').value,
    cart, total, savedAt: new Date().toISOString()
  };

  try{
    await window.storage.set('receipt:' + id, JSON.stringify(record), false);
    toast("Receipt saved");
    loadHistory();
  } catch(e){
    console.error(e);
    toast("Could not save (storage unavailable)");
  }
}
$('saveBtn').addEventListener('click', saveReceipt);

async function loadHistory(){
  const list = $('historyList');
  try{
    const res = await window.storage.list('receipt:', false);
    const keys = (res && res.keys) ? res.keys : [];
    if(keys.length === 0){
      list.innerHTML = '<div class="cart-empty">No saved receipts yet.</div>';
      return;
    }
    const records = [];
    for(const k of keys){
      try{
        const r = await window.storage.get(k, false);
        if(r) records.push(JSON.parse(r.value));
      }catch(e){ /* skip missing */ }
    }
    records.sort((a,b)=> new Date(b.savedAt) - new Date(a.savedAt));
    list.innerHTML = records.map(r => `
      <div class="history-item">
        <div>
          <div>${r.receiptNo}</div>
          <div class="meta">${fmtDate(r.deliveryDate)} · ${r.cart.length} size(s)</div>
        </div>
        <div style="display:flex;align-items:center;gap:10px;">
          <span class="amt">${peso(r.total)}</span>
          <button class="btn btn-ghost btn-sm" onclick="loadReceipt('${r.id}')">Open</button>
        </div>
      </div>
    `).join('');
  } catch(e){
    console.error(e);
    list.innerHTML = '<div class="cart-empty">Storage unavailable.</div>';
  }
}

window.loadReceipt = async function(id){
  try{
    const r = await window.storage.get('receipt:' + id, false);
    if(!r) return;
    const rec = JSON.parse(r.value);
    currentId = rec.id;
    cart = rec.cart || [];
    $('receiptNo').value = rec.receiptNo;
    $('deliveryDate').value = rec.deliveryDate;
    $('claimDate').value = rec.claimDate;
    render();
    toast("Receipt loaded: " + rec.receiptNo);
    window.scrollTo({top:0, behavior:'smooth'});
  } catch(e){
    console.error(e);
    toast("Could not open receipt");
  }
};

window.removeItem = removeItem;

$('toggleHistoryBtn').addEventListener('click', () => {
  const p = $('historyPanel');
  const show = p.style.display === 'none';
  p.style.display = show ? 'block' : 'none';
  if(show) loadHistory();
});

/* ===================== INIT ===================== */
async function init(){
  refreshLevels();
  $('receiptNo').value = await genReceiptNo();
  $('deliveryDate').value = todayISO();
  render();
}
init();
