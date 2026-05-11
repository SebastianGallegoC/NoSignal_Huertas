# Buenas Prácticas y Estándares de Desarrollo

## 1. Código Limpio (Clean Code)
- **Nombramiento:** Variables y funciones en inglés, descriptivas y bajo estándar camelCase (JS) y snake_case (Python).
- **Principio de Responsabilidad Única (SRP):** Cada componente o función debe hacer solo una cosa. Si un componente de formulario tiene más de 200 líneas, debe modularizarse.

## 2. Robustez Offline
- **Validación Dual:** Validar datos en el cliente (para feedback inmediato) y en el servidor (por seguridad).
- **Manejo de Errores:** Implementar "Graceful Degradation". Si el GPS falla o el usuario deniega el permiso, la app debe informar claramente y permitir reintentar sin bloquearse.
- **Atomicidad:** El envío de un formulario con múltiples fotos debe tratarse como una sola transacción. Si falla una foto, no se marca como enviado.

## 3. Rendimiento (Performance)
- **Lazy Loading:** Carga diferida de componentes pesados para que la PWA inicie instantáneamente.
- **Image Optimization:** Las imágenes deben comprimirse en el cliente a un máximo de 1280px de ancho antes de guardarse en IndexedDB para evitar latencia de lectura/escritura.

## 4. Seguridad
- **Sanitización:** Limpiar todos los inputs del formulario para evitar inyección XSS o SQL.
- **Principio de Menor Privilegio:** El JWT debe tener los permisos mínimos necesarios y una duración razonable.
- **HTTPS:** No se permitirá ninguna conexión vía HTTP plano debido a que las APIs de Cámara y GPS son consideradas "Secure Contexts".

## 5. Control de Versiones
- **Commits Semánticos:** Seguir el estándar `feat:`, `fix:`, `docs:`, `refactor:`.
- **Pull Requests:** Todo cambio debe pasar CI (`lint`, `build`, `tests`) antes de merge.

## 6. Operación y DevOps
- **Migraciones de DB:** Usar Alembic para cambios de esquema; evitar depender de creación automática en producción.
- **Secretos:** Nunca dejar `JWT_SECRET`, credenciales DB o usuarios de auth con valores por defecto inseguros.
- **Observabilidad:** Registrar errores 500 con contexto y mantener healthchecks de app/DB.