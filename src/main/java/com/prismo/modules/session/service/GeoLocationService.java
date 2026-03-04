package com.prismo.modules.session.service;

import com.maxmind.geoip2.DatabaseReader;
import com.maxmind.geoip2.model.CountryResponse;
import org.springframework.stereotype.Service;
import jakarta.annotation.PostConstruct;
import java.io.InputStream;
import java.net.InetAddress;

@Service
public class GeoLocationService {

    private DatabaseReader dbReader;

    @PostConstruct
    public void init() {
        try {
            // Carrega o banco de dados de GeoIP a partir do classpath
            InputStream dbStream = getClass().getResourceAsStream("/GeoLite2-Country.mmdb");
            if (dbStream != null) {
                this.dbReader = new DatabaseReader.Builder(dbStream).build();
            }
        } catch (Exception e) {
            // Em caso de erro, o serviço continuará retornando "UNKNOWN"
            System.err.println("Erro ao carregar banco de dados GeoIP: " + e.getMessage());
        }
    }

    public String getCountryByIp(String ipAddress) {
        if (dbReader == null || ipAddress == null || ipAddress.equals("127.0.0.1") || ipAddress.equals("0:0:0:0:0:0:0:1")) {
            return "LOCAL";
        }

        try {
            InetAddress ip = InetAddress.getByName(ipAddress);
            CountryResponse response = dbReader.country(ip);
            return response.getCountry().getName(); // Retorna o nome do país
        } catch (Exception e) {
            return "UNKNOWN";
        }
    }
}