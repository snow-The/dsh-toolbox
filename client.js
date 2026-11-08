// dsh-toolbox client — 我們工具插件共用的「設置」面。
//
// 為什麼共用：dsh-memory、busyloop、session-handoff 三個都**不需要看資料**，
// 只需要（1）調整設定（2）匯出。把它們合成一頁，比三頁各自手畫表單合理，也少三份要維護的 UI。
//
// 設定不是自己畫的資料模型：值來自 ctx.configForms（宿主依各插件的 Config schema 提供的
// 即時表單），寫入走 form.set(field, value)，由宿主驗證後套用並 HMR 更新。
// 這一層照現行官方做法（見 docs/cookbook/adding-a-settings-card），
// 而不是早期 busyloop 那種手寫 settings.section 表單。
//
// 匯出只打**已經存在**的端點；打不通就把錯誤顯示出來，不假裝成功。
window.__ModuleLoader__.load({
  id: '@snow-the/dsh-toolbox',
  factory: (require) => {
    const module = { exports: {} };
    const exports = module.exports;
    const React = require('react');
    const jsxrt = require('react/jsx-runtime');
    const jsx = jsxrt.jsx;
    const jsxs = jsxrt.jsxs;
    const useState = React.useState;
    const useEffect = React.useEffect;

    // 共用面板要覆蓋的命名空間。順序就是卡片順序。
    //
    // ⚠️ `aliases` 不是裝飾：ConfigForms 用**兩個不同的鍵**——
    //   `get(entryId)` 用 loader 條目 id，而 `whileServed()` 過濾的是 describe mirror 的
    //   `view.ns`（namespace）。條目 id 與套件名不一定相同（handoff 的條目是
    //   `session-handoff`，套件名是 `dsh-session-handoff`），兩者混用時的症狀是
    //   **卡片安靜消失**：沒有錯誤、沒有警告。所以這裡同時列出候選，取第一個 ready 的。
    const SPECS = [
      {
        id: 'dsh-memory',
        aliases: ['dsh-memory'],
        title: '記憶 · dsh-memory',
        hint: '原文索引 + 精選記憶 + 壓縮摘要。索引本身可重建，筆記與摘要不可重建。',
        export: { url: '/memory/api/export', filename: 'dsh-memory-export.json', label: '匯出記憶' },
      },
      {
        id: 'dsh-busyloop',
        aliases: ['dsh-busyloop'],
        title: '通道 · busyloop',
        hint: '各通道用哪把金鑰、設定從哪裡來。金鑰值不會回到前端。',
        export: { url: '/api/busyloop/channels', filename: 'busyloop-channels.json', label: '匯出通道' },
      },
      {
        id: 'dsh-session-handoff',
        aliases: ['session-handoff', 'dsh-session-handoff'],
        title: '交接 · session-handoff',
        hint: 'ACP 摺疊與交接文件。匯出用 handoff_export 工具（它會寫成 markdown 檔並回傳路徑）。',
        export: null,
      },
    ];

    const S = {
      wrap: { display: 'flex', flexDirection: 'column', gap: 16, fontSize: 13 },
      card: { border: '1px solid var(--dsh-border, #262b36)', borderRadius: 10, padding: '12px 14px' },
      head: { display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 4, flexWrap: 'wrap' },
      title: { fontSize: 14, fontWeight: 600, margin: 0, color: 'var(--dsh-text-primary, #e6e9ef)' },
      hint: { fontSize: 12, color: 'var(--dsh-text-secondary, #8b93a7)', margin: '0 0 10px' },
      row: { display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0', borderTop: '1px solid var(--dsh-border, #262b36)' },
      label: { flex: '0 0 190px', fontSize: 12, color: 'var(--dsh-text-secondary, #8b93a7)', fontFamily: 'ui-monospace, Consolas, monospace' },
      input: {
        flex: '1 1 160px', minWidth: 100, padding: '5px 8px', borderRadius: 6, fontSize: 12,
        border: '1px solid var(--dsh-border, #262b36)', background: 'var(--dsh-bg-input, #171a21)',
        color: 'var(--dsh-text-primary, #e6e9ef)', outline: 'none',
      },
      btn: {
        padding: '5px 11px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
        border: '1px solid var(--dsh-border, #262b36)', background: 'var(--dsh-bg-elevated, #171a21)',
        color: 'var(--dsh-text-primary, #e6e9ef)',
      },
      overridden: { fontSize: 10, padding: '1px 5px', borderRadius: 4, border: '1px solid #3d3355', color: '#c8b3ff' },
      err: { color: '#e5534b', fontSize: 12, marginTop: 6 },
      ok: { color: '#8ef0b0', fontSize: 12, marginTop: 6 },
      muted: { color: 'var(--dsh-text-secondary, #8b93a7)', fontSize: 12 },
    };

    function useSnapshot(form) {
      const [snap, setSnap] = useState(function () { return form.getSnapshot(); });
      useEffect(function () {
        setSnap(form.getSnapshot());
        return form.subscribe(function () { setSnap(form.getSnapshot()); });
      }, [form]);
      return snap;
    }

    function isOverride(user, key) {
      return Boolean(user && typeof user === 'object' && Object.prototype.hasOwnProperty.call(user, key));
    }

    function Field(props) {
      const key = props.field;
      const value = props.value;
      const onChange = props.onChange;
      const type = typeof value;
      if (value !== null && type === 'object') {
        return jsx('div', { style: S.row, children: [
          jsx('span', { style: S.label, children: key }),
          jsx('span', { style: S.muted, children: '（物件，請在 yaml 改）' }),
        ] });
      }
      let control;
      if (type === 'boolean') {
        control = jsx('input', { type: 'checkbox', checked: Boolean(value), onChange: function (e) { onChange(e.target.checked); } });
      } else if (type === 'number') {
        control = jsx('input', {
          style: S.input, type: 'number', value: String(value),
          onChange: function (e) { const n = Number(e.target.value); if (!Number.isNaN(n)) onChange(n); },
        });
      } else {
        control = jsx('input', {
          style: S.input, type: 'text', value: String(value),
          onChange: function (e) { onChange(e.target.value); },
        });
      }
      return jsxs('div', {
        style: S.row,
        children: [
          jsx('span', { style: S.label, children: key }),
          control,
          props.overridden ? jsx('span', { style: S.overridden, children: '已覆寫' }) : null,
        ],
      });
    }

    function NamespaceCard(props) {
      const spec = props.spec;
      const snap = useSnapshot(props.form);
      const [msg, setMsg] = useState(null);
      const [busy, setBusy] = useState(false);

      const write = async function (field, value) {
        try {
          const okWrite = await props.form.set(field, value);
          setMsg(okWrite ? null : { err: '宿主拒絕了這次寫入（值可能不合法）' });
        } catch (e) { setMsg({ err: '寫入失敗：' + String(e && e.message || e) }); }
      };

      const doExport = async function () {
        if (!spec.export) return;
        setBusy(true); setMsg(null);
        try {
          const r = await fetch(spec.export.url, { headers: { accept: 'application/json' } });
          if (!r.ok) throw new Error('HTTP ' + r.status);
          const text = await r.text();
          const blob = new Blob([text], { type: 'application/json' });
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = spec.export.filename;
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
          setMsg({ ok: '已匯出 ' + spec.export.filename + '（' + text.length + ' bytes）' });
        } catch (e) { setMsg({ err: '匯出失敗：' + String(e && e.message || e) }); }
        finally { setBusy(false); }
      };

      const value = snap.value || {};
      const keys = Object.keys(value).filter(function (k) { return typeof value[k] !== 'function'; });

      let body;
      if (snap.status === 'unavailable') {
        body = jsx('p', { style: S.muted, children: '宿主沒有提供這個命名空間的設定（插件未啟用或沒有 Config）。' });
      } else if (snap.status === 'loading' || !snap.value) {
        body = jsx('p', { style: S.muted, children: '載入中…' });
      } else if (!keys.length) {
        body = jsx('p', { style: S.muted, children: '這個插件沒有可調欄位。' });
      } else {
        body = keys.map(function (k) {
          return jsx(Field, {
            key: k, field: k, value: value[k],
            overridden: isOverride(snap.user, k),
            onChange: function (v) { write(k, v); },
          });
        });
      }

      return jsxs('section', {
        style: S.card,
        children: [
          jsxs('div', {
            style: S.head,
            children: [
              jsx('h3', { style: S.title, children: spec.title }),
              snap.writable === false ? jsx('span', { style: S.overridden, children: '唯讀' }) : null,
              jsx('span', { style: { flex: 1 } }),
              spec.export ? jsx('button', { style: S.btn, onClick: doExport, disabled: busy, children: busy ? '匯出中…' : spec.export.label }) : null,
            ],
          }),
          jsx('p', { style: S.hint, children: spec.hint }),
          body,
          msg && msg.err ? jsx('div', { style: S.err, children: msg.err }) : null,
          msg && msg.ok ? jsx('div', { style: S.ok, children: msg.ok }) : null,
        ],
      });
    }

    /**
     * 一個 spec 準備好了沒：挑第一個 ready 的表單。
     * 判準是**表單本身**（entryId 的 snapshot.status），不是 `whileServed` 的 namespace 清單——
     * 那兩個鍵在 handoff 這種「條目 id ≠ 套件名」的插件上不同，混用就是卡片安靜消失。
     */
    function pickForm(forms, spec) {
      for (const alias of spec.aliases || [spec.id]) {
        const form = forms[alias];
        if (!form || typeof form.getSnapshot !== 'function') continue;
        const snap = form.getSnapshot();
        if (snap && snap.status === 'ready') return { form: form, key: alias, snap: snap };
      }
      return null;
    }

    /** 訂閱所有候選表單，任何一個從 loading → ready 就重畫。 */
    function useResolved(forms) {
      const state = React.useState(0);
      const bump = state[1];
      React.useEffect(function () {
        const offs = [];
        for (const spec of SPECS) {
          for (const alias of spec.aliases || [spec.id]) {
            const form = forms[alias];
            if (!form || typeof form.subscribe !== 'function') continue;
            const off = form.subscribe(function () { bump(function (n) { return n + 1; }); });
            if (typeof off === 'function') offs.push(off);
          }
        }
        return function () {
          for (const off of offs) { try { off(); } catch (e) { /* 已釋放 */ } }
        };
      }, []);
      const resolved = {};
      const missing = [];
      for (const spec of SPECS) {
        const hit = pickForm(forms, spec);
        if (hit) resolved[spec.id] = hit;
        else missing.push(spec);
      }
      return { resolved: resolved, missing: missing };
    }

    function ToolboxPanel(props) {
      const got = useResolved(props.forms);
      const cards = SPECS.filter(function (s) { return got.resolved[s.id]; });
      // 「沒有可設定的插件」與「有插件但表單還沒 served」在畫面上必須長得不一樣，
      // 否則前者會蓋住後者——那是我們這個面板最常犯的錯。
      const missingLine = got.missing.length
        ? jsx('p', { key: 'missing', style: S.muted, children:
            '尚未提供設定表單：' + got.missing.map(function (s) { return s.id + '（試過 ' + (s.aliases || [s.id]).join(' / ') + '）'; }).join('、') })
        : null;
      if (!cards.length && !missingLine) {
        return jsx('p', { style: S.muted, children: '沒有可設定的工具插件在線。' });
      }
      return jsx('div', {
        style: S.wrap,
        children: cards.map(function (s) {
          const hit = got.resolved[s.id];
          return jsx(NamespaceCard, { key: s.id, spec: s, form: hit.form, formKey: hit.key, snap: hit.snap });
        }).concat(missingLine ? [missingLine] : []),
      });
    }

    const inject = ['slots', 'configForms'];

    function apply(ctx) {
      const forms = {};
      for (const s of SPECS) for (const alias of s.aliases || [s.id]) forms[alias] = ctx.configForms.get(alias);

      // 座位本身**不再**用 whileServed 當閘：那個閘用的是 namespace，
      // 與 get() 的 entryId 不是同一個鍵。頁面永遠註冊，內容自己決定有沒有卡。
      ctx.effect(function () {
        return ctx.slots.inject('settings.section', function () {
          return ctx.slots.register({
            name: 'settings.section',
            id: '@snow-the/dsh-toolbox',
            order: 63,
            label: function () { return '工具設定'; },
          }, function () { return jsx(ToolboxPanel, { forms: forms }); });
        });
      }, 'dsh-toolbox: shared settings page');
    }

    exports.SPECS = SPECS;
    exports.inject = inject;
    exports.apply = apply;
    return module.exports;
  },
});
