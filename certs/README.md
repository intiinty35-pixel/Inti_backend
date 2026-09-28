# Certificado CA de Supabase

`prod-ca-2021.crt` es la **CA raiz publica** de Supabase (`CN = Supabase Root 2021 CA`,
`O = Supabase Inc`). Se versiona a proposito: es un certificado publico, no un secreto.

## Por que existe

La cadena de certificados que presenta Supabase es:

```
*.pooler.supabase.com            (leaf)
  └── Supabase Intermediate 2021 CA
        └── Supabase Root 2021 CA   <-- este archivo
```

`Supabase Root 2021 CA` **no** esta en el almacen de confianza de Node/pg, asi que
`sslmode=verify-full` sin `sslrootcert` falla con:

```
self-signed certificate in certificate chain
```

Ese error es exactamente la razon por la que el proyecto usaba `sslmode=no-verify`,
que desactiva la verificacion del servidor y deja la conexion a la base de datos
expuesta a un ataque man-in-the-middle.

## Como se genero

Capturado desde el handshake TLS del propio pooler de Supabase (el nodo raiz es
autocertificado, por lo que es identico al archivo que se descarga desde
Dashboard → Database Settings → SSL Configuration). Se puede regenerar con
`node scripts/capture-supabase-ca.js` desde la raiz del backend.

## Uso

Ambas URLs de conexion deben incluir `sslmode=verify-full` **y**
`sslrootcert=certs/prod-ca-2021.crt`. `validateEnv()` rechaza el arranque si
`sslmode` es `no-verify`/`disable`, o si `verify-full` viene sin `sslrootcert`.

## Rotacion

El certificado expira el **2031-04-26**. Cuando Supabase publique una CA nueva,
reemplaza este archivo y vuelve a verificar con el script.
