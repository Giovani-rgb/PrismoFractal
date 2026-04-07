/// <reference lib="webworker" />
import { decryptData } from '../helpers/session.helpers';

addEventListener('message', async ({ data }) => {
  const { raw, secret } = data;

  try {
    // 1. Descriptografia (AES-GCM)
    const session = await decryptData(raw, secret);

    // 2. Validação de Entropia (Porta XOR) - Agora no Worker!
    const size = new Blob([JSON.stringify(session)]).size;
    const density = Math.log(size || 1);

    if (!(size ^ Math.floor(density)) || size === 0 || !session?.id_prospect) {
      throw new Error("Porta XOR: Falha de veracidade ou conformidade.");
    }

    // 3. Devolve o objeto pronto e os cálculos de peso
    postMessage({ 
      success: true, 
      session, 
      weight: (size / 1024).toFixed(2),
      density: density.toFixed(4)
    });

  } catch (error: any) {
    postMessage({ success: false, error: error.message });
  }
});
