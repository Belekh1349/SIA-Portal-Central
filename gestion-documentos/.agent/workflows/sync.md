---
description: Protocolo de Sincronización SIA (Firebase + GitHub)
---
Este flujo DEBE ejecutarse después de cualquier cambio significativo en el portal SIA o la app SIRECOA.

// turbo-all
1. Verificar estado de archivos
   `git status`

2. Sincronizar con GitHub
   `git add . && git commit -m "update: [descripción de los cambios]" && git push origin main`

3. Desplegar a Firebase (Solo si se solicita)
   - SIRECOA: `firebase deploy --project sirecoa-pro --only hosting` (desde LU_deploy_clean)
   - PORTAL SIA: `firebase deploy --project sia-control --only hosting` (desde raíz)

4. Notificar éxito
   Comunicar al usuario que tanto GitHub como Firebase están actualizados.
