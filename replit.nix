{ pkgs }: {
    deps = [
      pkgs.inetutils
      pkgs.unixtools.ping
        pkgs.graalvm17-ce
        pkgs.maven
        pkgs.replitPackages.jdt-language-server
        pkgs.replitPackages.java-debug
    ];
}