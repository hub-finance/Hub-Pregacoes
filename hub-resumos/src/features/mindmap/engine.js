/**
 * Motor do mapa mental interativo — desenho em <canvas>, arrastar, zoom
 * (roda do mouse, botões e pinça no celular), toque para abrir um assunto e
 * ver o texto completo de cada desdobramento.
 *
 * É JavaScript puro, sem dependências, de propósito: o mesmo código desenha o
 * mapa dentro do app e vai embutido no arquivo .html que o usuário baixa —
 * que abre em qualquer navegador, sem internet e sem o Hub Resumos.
 *
 * data: { center: { label, tip }, modules: [{ id, label, color, textColor, tip, children: [{ label, color, tip }] }] }
 * opts: { onSelect(node), onHover(node, x, y), background, gold, goldLight, childText }
 */
function createMindMap(canvas, data, opts) {
  opts = opts || {};
  var ctx = canvas.getContext('2d');
  var BG = opts.background || '#071320';
  var GOLD = opts.gold || '#C9973A';
  var GOLD_LIGHT = opts.goldLight || '#E8B96A';
  var CHILD_TEXT = opts.childText || '#D9E0E9';
  var CENTER_R = 92, MR = 64, CR = 50;
  var W = 0, H = 0, DPR = 1;
  var scale = 1, tx = 0, ty = 0;
  var showAll = false;
  var expanded = new Set();
  var hovered = null;

  /* ------------------------------- posições ------------------------------ */
  var modules = data.modules || [];
  var n = Math.max(modules.length, 1);
  var R1 = Math.max(230, (n * (2 * MR + 36)) / (2 * Math.PI));
  function toCart(deg, r) {
    var a = ((deg - 90) * Math.PI) / 180;
    return { x: Math.cos(a) * r, y: Math.sin(a) * r };
  }
  modules.forEach(function (m, i) {
    m._angle = (i * 360) / n;
    var p = toCart(m._angle, R1);
    m.x = p.x;
    m.y = p.y;
    // desdobramentos em anéis, centrados no ângulo do assunto
    var placed = 0, ring = 0;
    var kids = m.children || [];
    var sector = Math.min(360 / n, 150);
    while (placed < kids.length) {
      var r = R1 + 175 + ring * 118;
      var stepDeg = (((2 * CR + 16) / r) * 180) / Math.PI;
      var capacity = Math.max(1, Math.floor(sector / stepDeg));
      var count = Math.min(capacity, kids.length - placed);
      for (var k = 0; k < count; k++) {
        var ang = m._angle + (k - (count - 1) / 2) * stepDeg + (ring % 2 ? stepDeg / 2 : 0);
        var cp = toCart(ang, r);
        kids[placed + k].x = cp.x;
        kids[placed + k].y = cp.y;
        kids[placed + k]._module = m;
      }
      placed += count;
      ring++;
    }
  });

  /* ------------------------------ conversões ----------------------------- */
  function wts(x, y) {
    return { x: W / 2 + (x + tx) * scale, y: H / 2 + (y + ty) * scale };
  }
  function stw(sx, sy) {
    return { x: (sx - W / 2) / scale - tx, y: (sy - H / 2) / scale - ty };
  }
  function isOpen(m) {
    return showAll || expanded.has(m.id);
  }

  /* -------------------------------- desenho ------------------------------ */
  function drawConn(c, a, b, color, width, dash) {
    var p = wtsOn(a.x, a.y), q = wtsOn(b.x, b.y);
    c.beginPath();
    c.strokeStyle = color;
    c.lineWidth = width * view.scale;
    c.setLineDash(dash ? [8 * view.scale, 5 * view.scale] : []);
    c.moveTo(p.x, p.y);
    c.lineTo(q.x, q.y);
    c.stroke();
    c.setLineDash([]);
  }
  // o mesmo desenho serve à tela e à imagem exportada: "view" diz qual
  var view = { w: 0, h: 0, scale: 1, tx: 0, ty: 0 };
  function wtsOn(x, y) {
    return { x: view.w / 2 + (x + view.tx) * view.scale, y: view.h / 2 + (y + view.ty) * view.scale };
  }
  function badge(c, node, n, fill, color) {
    var p = wtsOn(node.x + CR * 0.72, node.y - CR * 0.72);
    var r = 12 * view.scale;
    c.beginPath();
    c.arc(p.x, p.y, r, 0, Math.PI * 2);
    c.fillStyle = fill;
    c.fill();
    c.lineWidth = 1.5 * view.scale;
    c.strokeStyle = BG;
    c.stroke();
    c.fillStyle = color;
    c.font = 'bold ' + 11 * view.scale + "px 'Segoe UI', Arial, sans-serif";
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(String(n), p.x, p.y + 0.5);
  }
  function drawNode(c, node, r, fill, textColor, isHovered, maxFont, ring) {
    var p = wtsOn(node.x, node.y);
    var rad = r * view.scale;
    c.save();
    c.shadowColor = 'rgba(0,0,0,0.45)';
    c.shadowBlur = 14 * view.scale;
    c.beginPath();
    c.arc(p.x, p.y, rad, 0, Math.PI * 2);
    c.fillStyle = fill;
    c.fill();
    c.restore();
    if (ring) {
      c.beginPath();
      c.arc(p.x, p.y, rad - 1.5 * view.scale, 0, Math.PI * 2);
      c.strokeStyle = ring;
      c.lineWidth = 3 * view.scale;
      c.stroke();
    }
    if (isHovered) {
      c.beginPath();
      c.arc(p.x, p.y, rad + 4 * view.scale, 0, Math.PI * 2);
      c.strokeStyle = GOLD_LIGHT;
      c.lineWidth = 2.5 * view.scale;
      c.stroke();
    }
    var lines = String(node.label || '').split('\n');
    var fs = Math.max(10, Math.min(maxFont, (r * 1.7) / Math.max(6, longest(lines)) * 1.05)) * view.scale;
    c.fillStyle = textColor;
    c.font = 'bold ' + fs + "px 'Segoe UI', Arial, sans-serif";
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    var lh = fs * 1.22;
    var sy = p.y - ((lines.length - 1) * lh) / 2;
    lines.forEach(function (l, i) {
      c.fillText(l, p.x, sy + i * lh);
    });
  }
  function longest(lines) {
    return lines.reduce(function (m, l) {
      return Math.max(m, l.length);
    }, 0);
  }
  function paint(c, w, h) {
    c.clearRect(0, 0, w, h);
    c.fillStyle = BG;
    c.fillRect(0, 0, w, h);
    var origin = { x: 0, y: 0 };
    var focus = !showAll && expanded.size > 0;
    modules.forEach(function (m) {
      c.globalAlpha = focus && !isOpen(m) ? 0.3 : 1;
      drawConn(c, origin, m, m.color + '99', 2.5, false);
      if (isOpen(m))
        (m.children || []).forEach(function (ch) {
          drawConn(c, m, ch, m.color + 'AA', 1.6, false);
        });
    });
    c.globalAlpha = 1;
    // centro
    var cp = wtsOn(0, 0);
    c.save();
    c.shadowColor = 'rgba(0,0,0,0.5)';
    c.shadowBlur = 20 * view.scale;
    c.beginPath();
    c.arc(cp.x, cp.y, CENTER_R * view.scale, 0, Math.PI * 2);
    c.fillStyle = '#0D1B2A';
    c.fill();
    c.restore();
    c.beginPath();
    c.arc(cp.x, cp.y, CENTER_R * view.scale, 0, Math.PI * 2);
    c.strokeStyle = GOLD;
    c.lineWidth = 3 * view.scale;
    c.stroke();
    drawNode(c, { x: 0, y: 0, label: data.center.label }, CENTER_R, 'rgba(0,0,0,0)', GOLD, false, 20);
    modules.forEach(function (m) {
      c.globalAlpha = focus && !isOpen(m) ? 0.3 : 1;
      drawNode(c, m, MR, m.color, m.textColor || '#FFFFFF', hovered === m, 17);
      if (isOpen(m)) {
        // anel na cor do assunto: deixa claro a quem cada desdobramento pertence
        var mp = wtsOn(m.x, m.y);
        c.beginPath();
        c.arc(mp.x, mp.y, (MR + 5) * view.scale, 0, Math.PI * 2);
        c.strokeStyle = GOLD_LIGHT;
        c.lineWidth = 3 * view.scale;
        c.stroke();
        (m.children || []).forEach(function (ch, i) {
          drawNode(c, ch, CR, ch.color, CHILD_TEXT, hovered === ch, 14, m.color);
          badge(c, ch, i + 1, m.color, m.textColor || '#FFFFFF');
        });
      }
    });
    c.globalAlpha = 1;
  }
  function draw() {
    view.w = W;
    view.h = H;
    view.scale = scale;
    view.tx = tx;
    view.ty = ty;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    paint(ctx, W, H);
  }

  /* -------------------------------- tamanho ------------------------------ */
  function resize() {
    var rect = canvas.getBoundingClientRect();
    DPR = window.devicePixelRatio || 1;
    W = Math.max(1, rect.width);
    H = Math.max(1, rect.height);
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    draw();
  }
  function bounds(all) {
    var minX = -CENTER_R, maxX = CENTER_R, minY = -CENTER_R, maxY = CENTER_R;
    modules.forEach(function (m) {
      var nodes = [{ x: m.x, y: m.y, r: MR }];
      if (all || isOpen(m))
        (m.children || []).forEach(function (ch) {
          nodes.push({ x: ch.x, y: ch.y, r: CR });
        });
      nodes.forEach(function (p) {
        minX = Math.min(minX, p.x - p.r);
        maxX = Math.max(maxX, p.x + p.r);
        minY = Math.min(minY, p.y - p.r);
        maxY = Math.max(maxY, p.y + p.r);
      });
    });
    return { minX: minX, maxX: maxX, minY: minY, maxY: maxY };
  }
  function moduleBounds(m) {
    var b = { minX: m.x - MR, maxX: m.x + MR, minY: m.y - MR, maxY: m.y + MR };
    (m.children || []).forEach(function (ch) {
      b.minX = Math.min(b.minX, ch.x - CR);
      b.maxX = Math.max(b.maxX, ch.x + CR);
      b.minY = Math.min(b.minY, ch.y - CR);
      b.maxY = Math.max(b.maxY, ch.y + CR);
    });
    return b;
  }
  var anim = 0;
  /** Leva a câmera até o retângulo, com uma transição curta para não desorientar. */
  function fitTo(b, instant) {
    // área livre: o que sobra depois do título, dos botões, da legenda e do painel de texto
    var focused = !showAll && expanded.size > 0;
    var ins = (opts.insets && opts.insets(focused, W, H)) || { t: 30, r: 30, b: 30, l: 30 };
    var aw = Math.max(80, W - ins.l - ins.r), ah = Math.max(80, H - ins.t - ins.b);
    var s1 = Math.max(0.25, Math.min(1.3, Math.min(aw / (b.maxX - b.minX), ah / (b.maxY - b.minY))));
    // o centro da área livre fica no centro do retângulo
    var cx = ins.l + aw / 2, cy = ins.t + ah / 2;
    var x1 = (cx - W / 2) / s1 - (b.minX + b.maxX) / 2, y1 = (cy - H / 2) / s1 - (b.minY + b.maxY) / 2;
    if (anim) cancelAnimationFrame(anim);
    var reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (instant || reduce || typeof requestAnimationFrame === 'undefined') {
      scale = s1; tx = x1; ty = y1; draw();
      return;
    }
    var s0 = scale, x0 = tx, y0 = ty, t0 = 0;
    function step(t) {
      if (!t0) t0 = t;
      var k = Math.min(1, (t - t0) / 380);
      var e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      scale = s0 + (s1 - s0) * e; tx = x0 + (x1 - x0) * e; ty = y0 + (y1 - y0) * e;
      draw();
      anim = k < 1 ? requestAnimationFrame(step) : 0;
    }
    anim = requestAnimationFrame(step);
  }
  /** Enquadra o que está visível na tela. */
  function fit() {
    fitTo(bounds(false), true);
  }

  /* -------------------------------- toque -------------------------------- */
  function nodeAt(sx, sy) {
    var w = stw(sx, sy);
    for (var i = 0; i < modules.length; i++) {
      var m = modules[i];
      if (isOpen(m)) {
        var kids = m.children || [];
        for (var k = 0; k < kids.length; k++) {
          if (Math.hypot(w.x - kids[k].x, w.y - kids[k].y) <= CR) return { node: kids[k], type: 'child' };
        }
      }
      if (Math.hypot(w.x - m.x, w.y - m.y) <= MR) return { node: m, type: 'module' };
    }
    if (Math.hypot(w.x, w.y) <= CENTER_R) return { node: data.center, type: 'center' };
    return null;
  }
  function local(e) {
    var rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }
  function activate(hit) {
    if (!hit) return;
    if (hit.type === 'module' && !showAll) {
      var wasOpen = expanded.has(hit.node.id);
      expanded.clear();
      if (!wasOpen) expanded.add(hit.node.id);
      // um assunto por vez: a tela mostra só ele e os seus desdobramentos
      if (wasOpen) fitTo(bounds(false));
      else fitTo(moduleBounds(hit.node));
    } else if (hit.type === 'center' && !showAll) {
      expanded.clear();
      fitTo(bounds(false));
    }
    if (opts.onSelect) opts.onSelect(hit.node, hit.type);
  }

  var dragging = false, moved = 0, lastX = 0, lastY = 0, pinch = 0;
  // Depois de um toque, o navegador repete o mesmo toque como clique de mouse;
  // sem esta trava o assunto abria e fechava no mesmo toque (tablet/celular).
  var lastTouch = 0;
  function fromTouch() {
    return Date.now() - lastTouch < 800;
  }
  function onMouseDown(e) {
    if (fromTouch()) return;
    var p = local(e);
    dragging = true;
    moved = 0;
    lastX = p.x;
    lastY = p.y;
  }
  function onMouseMove(e) {
    if (fromTouch()) return;
    var p = local(e);
    if (dragging) {
      moved += Math.abs(p.x - lastX) + Math.abs(p.y - lastY);
      tx += (p.x - lastX) / scale;
      ty += (p.y - lastY) / scale;
      lastX = p.x;
      lastY = p.y;
      draw();
      return;
    }
    var hit = nodeAt(p.x, p.y);
    var node = hit ? hit.node : null;
    if (node !== hovered) {
      hovered = node;
      draw();
    }
    canvas.style.cursor = node ? 'pointer' : 'grab';
    if (opts.onHover) opts.onHover(node, e.clientX, e.clientY);
  }
  function onMouseUp(e) {
    if (fromTouch()) return;
    if (dragging && moved < 6) activate(nodeAt(local(e).x, local(e).y));
    dragging = false;
  }
  function onLeave() {
    dragging = false;
    hovered = null;
    if (opts.onHover) opts.onHover(null, 0, 0);
    draw();
  }
  function zoomAt(f, sx, sy) {
    var w = stw(sx, sy);
    scale = Math.max(0.2, Math.min(4, scale * f));
    tx = (sx - W / 2) / scale - w.x;
    ty = (sy - H / 2) / scale - w.y;
    draw();
  }
  function onWheel(e) {
    e.preventDefault();
    var p = local(e);
    zoomAt(e.deltaY < 0 ? 1.12 : 0.89, p.x, p.y);
  }
  function onTouchStart(e) {
    lastTouch = Date.now();
    if (e.touches.length === 1) {
      var p = local(e.touches[0]);
      dragging = true;
      moved = 0;
      lastX = p.x;
      lastY = p.y;
    } else if (e.touches.length === 2) {
      dragging = false;
      pinch = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    }
  }
  function onTouchMove(e) {
    e.preventDefault();
    if (e.touches.length === 1 && dragging) {
      var p = local(e.touches[0]);
      moved += Math.abs(p.x - lastX) + Math.abs(p.y - lastY);
      tx += (p.x - lastX) / scale;
      ty += (p.y - lastY) / scale;
      lastX = p.x;
      lastY = p.y;
      draw();
    } else if (e.touches.length === 2 && pinch) {
      var d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      var a = local(e.touches[0]), b = local(e.touches[1]);
      zoomAt(d / pinch, (a.x + b.x) / 2, (a.y + b.y) / 2);
      pinch = d;
    }
  }
  function onTouchEnd(e) {
    lastTouch = Date.now();
    if (dragging && moved < 8 && e.changedTouches.length === 1) {
      e.preventDefault();
      var p = local(e.changedTouches[0]);
      activate(nodeAt(p.x, p.y));
    }
    dragging = false;
    pinch = 0;
  }

  canvas.addEventListener('mousedown', onMouseDown);
  canvas.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('mouseleave', onLeave);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('touchstart', onTouchStart, { passive: false });
  canvas.addEventListener('touchmove', onTouchMove, { passive: false });
  canvas.addEventListener('touchend', onTouchEnd, { passive: false });
  var observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
  if (observer) observer.observe(canvas);
  else window.addEventListener('resize', resize);
  resize();
  fit();

  return {
    redraw: draw,
    resize: resize,
    reset: function () {
      expanded.clear();
      fitTo(bounds(false));
    },
    /** Abre um assunto pelo número (para a lista e o teclado). */
    open: function (id) {
      var m = modules.find(function (x) { return x.id === id; });
      if (m) activate({ node: m, type: 'module' });
    },
    zoom: function (f) {
      zoomAt(f, W / 2, H / 2);
    },
    /** Liga e desliga "expandir tudo"; devolve o novo estado. */
    toggleAll: function () {
      showAll = !showAll;
      expanded.clear();
      fitTo(bounds(false));
      return showAll;
    },
    /** O mapa inteiro, com tudo aberto, como imagem PNG. */
    toPNG: function (maxSide) {
      var b = bounds(true);
      var pad = 60;
      var bw = b.maxX - b.minX + pad * 2, bh = b.maxY - b.minY + pad * 2;
      var k = Math.min(2, (maxSide || 3000) / Math.max(bw, bh));
      var off = document.createElement('canvas');
      off.width = Math.round(bw * k);
      off.height = Math.round(bh * k);
      var c = off.getContext('2d');
      var keep = { w: view.w, h: view.h, scale: view.scale, tx: view.tx, ty: view.ty, all: showAll };
      view.w = off.width;
      view.h = off.height;
      view.scale = k;
      view.tx = -(b.minX + b.maxX) / 2;
      view.ty = -(b.minY + b.maxY) / 2;
      showAll = true;
      var h0 = hovered;
      hovered = null;
      paint(c, off.width, off.height);
      hovered = h0;
      showAll = keep.all;
      view.w = keep.w;
      view.h = keep.h;
      view.scale = keep.scale;
      view.tx = keep.tx;
      view.ty = keep.ty;
      return off.toDataURL('image/png');
    },
    destroy: function () {
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('mouseleave', onLeave);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
      if (anim) cancelAnimationFrame(anim);
      if (observer) observer.disconnect();
      else window.removeEventListener('resize', resize);
    },
  };
}

export { createMindMap };
