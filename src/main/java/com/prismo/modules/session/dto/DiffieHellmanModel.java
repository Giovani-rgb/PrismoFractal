package com.prismo.modules.session.dto;

import java.math.BigInteger;

/**
 * Modelo de Contexto para a Troca de Chaves Diffie-Hellman.
 * Utilizado para armazenar os parâmetros p, g, o segredo privado _a, o produto A
 * e calcular/armazenar o segredo compartilhado.
 */
public class DiffieHellmanModel {
    private BigInteger p;            // Número Primo (Módulo)
    private BigInteger g;            // Gerador
    private BigInteger _a;           // Expoente Privado (Segredo do Servidor)
    private BigInteger A;            // Chave Pública do Servidor (g^_a mod p)
    private BigInteger sharedSecret; // Segredo Compartilhado Final (B^_a mod p)

    public DiffieHellmanModel() {}

    // Construtor básico para orquestração inicial
    public DiffieHellmanModel(BigInteger p, BigInteger g, BigInteger _a, BigInteger A) {
        this.p = p;
        this.g = g;
        this._a = _a;
        this.A = A;
    }

    /**
     * Construtor Avançado: Recebe os parâmetros do servidor E a chave pública do cliente (B).
     * Calcula o sharedSecret automaticamente na inicialização da estrutura.
     */
    public DiffieHellmanModel(BigInteger p, BigInteger g, BigInteger _a, BigInteger A, BigInteger clientB) {
        this.p = p;
        this.g = g;
        this._a = _a;
        this.A = A;
        if (clientB != null && this.p != null && this._a != null) {
            // sharedSecret = B^_a mod p
            this.sharedSecret = clientB.modPow(this._a, this.p);
        }
    }

    /**
     * Método utilitário caso o modelo já exista e você precise computar 
     * o segredo assim que a chave do cliente (B) chegar.
     */
    public void computeSharedSecret(BigInteger clientB) {
        if (clientB == null) {
            throw new IllegalArgumentException("A chave pública do cliente (B) não pode ser nula.");
        }
        // sharedSecret = B^_a mod p
        this.sharedSecret = clientB.modPow(this._a, this.p);
    }

    /**
     * Zera os segredos em memória após o uso.
     */
    public void clearSecrets() {
        this._a = null;
        this.sharedSecret = null;
    }

    // Getters e Setters
    public BigInteger getP() { return p; }
    public void setP(BigInteger p) { this.p = p; }

    public BigInteger getG() { return g; }
    public void setG(BigInteger g) { this.g = g; }

    public BigInteger get_a() { return _a; }
    public void set_a(BigInteger _a) { this._a = _a; }

    public BigInteger getA() { return A; }
    public void setA(BigInteger A) { this.A = A; }

    public BigInteger getSharedSecret() { return sharedSecret; }
    public void setSharedSecret(BigInteger sharedSecret) { this.sharedSecret = sharedSecret; }
}
