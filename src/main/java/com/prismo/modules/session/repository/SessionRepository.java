package com.prismo.modules.session.repository;

import com.prismo.modules.session.model.Session;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SessionRepository extends JpaRepository<Session, UUID> {

    // Busca sessão por token (independente de estar revogada ou não)
    Optional<Session> findByToken(String token);

    // Busca sessão por token apenas se NÃO estiver revogada
    Optional<Session> findByTokenAndRevokedFalse(String token);

    // Busca todas sessões ativas de um usuário
    List<Session> findByUserIdAndRevokedFalse(UUID userId);
}