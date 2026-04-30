package com.prismo.modules.session.dto; // <--- ADICIONE O SEU PACOTE AQUI

import java.math.BigInteger;

/**
 * Modelo de Contexto para a Troca de Chaves Diffie-Hellman.
 * Utilizado para armazenar os parâmetros p, g, o segredo privado _a e o produto A.
 */
public class DiffieHellmanModel {
    private BigInteger p;  // Número Primo (Módulo)
    private BigInteger g;  // Gerador
    private BigInteger _a; // Expoente Privado (Segredo do Servidor)
    private BigInteger A;  // Chave Pública do Servidor (g^_a mod p)

    public DiffieHellmanModel() {}

    // Construtor completo para orquestração rápida
    public DiffieHellmanModel(BigInteger p, BigInteger g, BigInteger _a, BigInteger A) {
        this.p = p;
        this.g = g;
        this._a = _a;
        this.A = A;
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
}
