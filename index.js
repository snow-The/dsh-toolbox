// dsh-toolbox 宿主半側：刻意留空。
//
// 存在的唯一理由是讓 client 模組系統送瀏覽器半側（它只送「掛載的 Loader 行」所對應的
// 套件的 exports["./client"]）。所有 UI 在 client.js，所有設定來自各插件自己的 Config。
export const name = 'dsh-toolbox'
export const inject = []

export function apply() {
  // 沒有服務、沒有工具、沒有路由 —— 這是純 UI 套件。
}
