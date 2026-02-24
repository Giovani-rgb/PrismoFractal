package com.prismo.modules.session.repository;

import com.prismo.modules.session.model.Session;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SessionRepository extends JpaRepository<Session, UUID> {

    Optional<Session> findByToken(String token);

    List<Session> findByUserIdAndRevokedFalse(UUID userId);

}