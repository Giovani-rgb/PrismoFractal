import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { SessionService } from './session.service'; // Ajuste o caminho do seu service
import { environment } from '../../environments/environment';
import { createMockEncryptedPayload } from '../models/session.mocks'; // Fábrica criada anteriormente
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { firstValueFrom } from 'rxjs';

describe('SessionService', () => {
  let service: SessionService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        SessionService,
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });

    service = TestBed.inject(SessionService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify(); // Garante que nenhuma requisição HTTP ficou pendente
    vi.restoreAllMocks(); // Limpa spies do sessionStorage entre os testes
  });

  it('deve ser criado com as propriedades iniciais corretas', () => {
    expect(service).toBeTruthy();
    expect(service.sharedSecret).toBeNull();
  });

  describe('Endpoints HTTP (API)', () => {
    
    it('deve executar executePublicAssignment com o payload dinâmico correto', async () => {
      const mockPayload = { clientPublicKey: 'DH_KEY_ABC123' };
      const mockResponse = { serverPublicKey: 'DH_KEY_XYZ789', stage: 1 };

      const requestPromise = firstValueFrom(service.executePublicAssignment(mockPayload));

      // Captura e valida a chamada HTTP disparada
      const req = httpMock.expectOne(`${environment.apiUrl}/api/sessions/public`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(mockPayload);

      // Responde à requisição com o mock do servidor
      req.flush(mockResponse);

      const response = await requestPromise;
      expect(response).toEqual(mockResponse);
    });

    it('deve buscar uma nova sessão anônima via fetchNewSession', async () => {
      const mockEncryptedResponse = createMockEncryptedPayload();

      const requestPromise = firstValueFrom(service.fetchNewSession());

      const req = httpMock.expectOne(`${environment.apiUrl}/api/sessions/anonymous`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({});

      req.flush(mockEncryptedResponse);

      const response = await requestPromise;
      expect(response).toEqual(mockEncryptedResponse);
    });

    it('deve renovar cookies via refreshSessionCookies enviando credentials', async () => {
      const mockEncryptedResponse = createMockEncryptedPayload();

      const requestPromise = firstValueFrom(service.refreshSessionCookies());

      const req = httpMock.expectOne(`${environment.apiUrl}/api/sessions/refresh`);
      expect(req.request.method).toBe('POST');
      expect(req.request.withCredentials).toBe(true); // Regra crucial do CORS para cookies/sessões

      req.flush(mockEncryptedResponse);

      const response = await requestPromise;
      expect(response).toEqual(mockEncryptedResponse);
    });
  });

  describe('Persistência (sessionStorage)', () => {

    it('deve salvar o payload criptografado stringificado no sessionStorage se ele existir', () => {
      const mockPayload = createMockEncryptedPayload();
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');

      service.saveToStorage(mockPayload);

      expect(setItemSpy).toHaveBeenCalledWith(
        environment.nameSessionKey,
        JSON.stringify(mockPayload)
      );
    });

    it('deve retornar o payload parseado corretamente ao recuperar do storage', () => {
      const mockPayload = createMockEncryptedPayload();
      vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(JSON.stringify(mockPayload));

      const result = service.getFromStorage();

      expect(result).toEqual(mockPayload);
    });

    it('deve retornar null se o storage estiver vazio', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);

      const result = service.getFromStorage();

      expect(result).toBeNull();
    });

    it('deve recuperar com resiliência retornando null se o JSON for corrompido/inválido', () => {
      // Simula um cenário onde o dado guardado quebrou a estrutura de objeto stringificado
      vi.spyOn(Storage.prototype, 'getItem').mockReturnValue('{bizarre_payload_corrupted:');

      const result = service.getFromStorage();

      // Graças ao try/catch implementado no seu service, não deve estourar erro
      expect(result).toBeNull();
    });
  });
});
