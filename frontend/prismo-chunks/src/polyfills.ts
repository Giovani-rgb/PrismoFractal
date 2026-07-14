/**
 * Polyfills para compatibilidade com Stellar SDK e Pi Network no browser.
 *
 * O @stellar/stellar-sdk e bibliotecas subjacentes (tweetnacl, evp_bytestokey,
 * elliptic) exigem globals do Node.js que não existem no browser por padrão.
 *
 * Instalação das dependências (quando usar Stellar SDK diretamente):
 *   npm install buffer process --save
 *   npm install --save-dev @types/node
 *
 * No angular.json, adicione em allowedCommonJsDependencies:
 *   ["buffer", "process"]
 */

// ─── Global ───────────────────────────────────────────────────────
// Stellar SDK acessa `global` em alguns módulos
if (typeof (window as any)['global'] === 'undefined') {
  (window as any)['global'] = window;
}

// ─── Process ──────────────────────────────────────────────────────
// Requerido por stellar-base e crypto libs
if (typeof (window as any)['process'] === 'undefined') {
  (window as any)['process'] = {
    env:      {},
    version:  '',
    browser:  true,
    nextTick: (fn: (...args: any[]) => void, ...args: any[]) => setTimeout(() => fn(...args), 0)
  };
}

// ─── Buffer ───────────────────────────────────────────────────────
// Instale o pacote `buffer` via npm e descomente o bloco abaixo
// para habilitar o suporte completo ao Stellar SDK no browser:
//
// import { Buffer } from 'buffer';
// if (typeof (window as any)['Buffer'] === 'undefined') {
//   (window as any)['Buffer'] = Buffer;
// }
//
// Enquanto isso, usamos um stub mínimo para não quebrar imports condicionais:
if (typeof (window as any)['Buffer'] === 'undefined') {
  (window as any)['Buffer'] = {
    from:         (data: any, encoding?: string) => new Uint8Array(typeof data === 'string' ? [] : data),
    alloc:        (size: number) => new Uint8Array(size),
    allocUnsafe:  (size: number) => new Uint8Array(size),
    isBuffer:     (_obj: any) => false,
    concat:       (list: Uint8Array[]) => {
      const len = list.reduce((acc, b) => acc + b.length, 0);
      const out = new Uint8Array(len);
      let off = 0;
      for (const b of list) { out.set(b, off); off += b.length; }
      return out;
    }
  };
}
