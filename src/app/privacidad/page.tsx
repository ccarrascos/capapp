import Link from "next/link";

export default function PoliticaPrivacidadPage() {
  return (
    <div className="min-h-dvh bg-background px-6 py-12">
      <div className="mx-auto max-w-2xl flex flex-col gap-8">
        <Link href="/login" className="flex items-center gap-2.5 w-fit">
          <span className="flex size-8 items-center justify-center rounded-sm overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element -- logo estático, no requiere optimización de next/image */}
            <img src="/logo-icon.png" alt="Capapp" className="size-full object-contain" loading="lazy" />
          </span>
          <span className="font-heading text-lg tracking-wide uppercase">Capapp</span>
        </Link>

        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Ley N.º 21.719</p>
          <h1 className="font-heading text-3xl font-bold uppercase tracking-tight mt-1">
            Política de privacidad
          </h1>
          <p className="text-sm text-muted-foreground mt-2">Última actualización: noviembre de 2026.</p>
        </div>

        <section className="flex flex-col gap-3">
          <h2 className="font-heading text-lg font-bold uppercase tracking-wide">1. Quién trata tus datos</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Tu empleador (la organización a la que estás vinculado en Capapp) es el responsable del tratamiento de
            tus datos personales. Capapp actúa como proveedor tecnológico que procesa esos datos por encargo del
            empleador, únicamente para los fines descritos en esta política.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-heading text-lg font-bold uppercase tracking-wide">2. Qué datos recabamos</h2>
          <ul className="text-sm text-muted-foreground leading-relaxed list-disc pl-5 space-y-1">
            <li>Identificación: RUT, nombres, apellidos, fecha de nacimiento y sexo.</li>
            <li>Contacto: correo electrónico, teléfono.</li>
            <li>Datos laborales: cargo, modalidad contractual, organización y centro de trabajo.</li>
            <li>
              Datos de capacitación: inscripciones, asistencia por módulo, evaluaciones, certificados y su fecha de
              vigencia.
            </li>
            <li>Credenciales de acceso a la plataforma (tu contraseña se almacena cifrada; nunca en texto plano).</li>
            <li>Foto de perfil, sólo si decides subir una.</li>
            <li>
              Registros técnicos: intentos fallidos de inicio de sesión (RUT y hora, que se borran a las 24 horas) y
              una bitácora de los cambios administrativos hechos sobre tu cuenta.
            </li>
          </ul>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-heading text-lg font-bold uppercase tracking-wide">
            3. Para qué usamos tus datos
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Exclusivamente para gestionar y acreditar tu capacitación en prevención de riesgos laborales conforme al
            artículo 16 del DS N.º 44/2023, incluyendo la emisión de certificados y el cálculo de su vigencia. La
            fecha de nacimiento y el sexo se usan además para elaborar reportes de cumplimiento por rango etario y
            con enfoque de género. Los registros técnicos se usan sólo para proteger las cuentas y dejar trazabilidad
            de los cambios.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-heading text-lg font-bold uppercase tracking-wide">4. Base legal</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Tratamos tus datos para el cumplimiento de una obligación legal (el DS N.º 44/2023 exige esta
            capacitación y su registro), por lo que este tratamiento no requiere tu consentimiento previo. No usamos
            tus datos para fines distintos a los aquí descritos.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-heading text-lg font-bold uppercase tracking-wide">
            5. Retiro del consentimiento
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Los datos de identificación, contacto, laborales y de capacitación son necesarios para cumplir la
            obligación legal descrita en el punto 4, por lo que su tratamiento no depende de tu consentimiento. La
            foto de perfil, en cambio, la subes voluntariamente: puedes retirar ese consentimiento en cualquier
            momento desde <span className="font-medium text-foreground">Mi perfil → Quitar foto</span>. La foto se
            borra y deja de mostrarse en la plataforma y en tu credencial. El retiro no afecta la licitud del
            tratamiento realizado antes de ese momento.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-heading text-lg font-bold uppercase tracking-wide">
            6. Decisiones automatizadas y elaboración de perfiles
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Capapp calcula automáticamente el estado de vigencia de tu capacitación (vigente, por vencer, vencida o
            sin capacitación) con una regla fija de fechas: tu capacitación vence al cumplirse el plazo de vigencia
            del certificado, contado desde la fecha en que la aprobaste, y se marca &quot;por vencer&quot; cuando
            faltan pocos días para esa fecha (tu organización define cuántos). La aprobación de un curso no es
            automática: la registra el facilitador o quien administra la capacitación.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Tu empleador usa ese estado para autorizarte a realizar trabajos que exigen esta capacitación. Por eso,
            si tu capacitación aparece vencida o sin registro, es posible que no se te autorice a realizar esas
            tareas hasta regularizarla. Esa autorización la decide tu empleador, no la plataforma. Si crees que tu
            estado es incorrecto (por ejemplo, porque falta registrar un curso que aprobaste), puedes pedir que una
            persona lo revise y lo corrija por los canales de tu empresa, según se indica en el punto 9.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            No elaboramos perfiles sobre ti. Los reportes por rango etario y sexo son agregados y no se usan para
            evaluarte individualmente. El asistente de inteligencia artificial sólo responde consultas de quienes
            administran la capacitación y no toma decisiones sobre ti.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-heading text-lg font-bold uppercase tracking-wide">7. Con quién se comparten</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Con tu empleador y quienes administran la capacitación dentro de tu organización. Quien escanee el código
            QR de tu credencial o de tu certificado ve tu nombre, RUT y estado de capacitación (y, en la credencial,
            tu cargo, centro de trabajo y foto de perfil si subiste una), igual que lo permitiría un documento
            físico, para efectos de fiscalización.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Para funcionar, Capapp usa proveedores tecnológicos que procesan datos por su cuenta, con servidores
            fuera de Chile: Supabase (base de datos y autenticación), Vercel (alojamiento de la aplicación), Resend
            (envío de correos de acceso) y Groq (asistente de inteligencia artificial, disponible sólo para quienes
            administran la capacitación: sus consultas pueden incluir nombres, RUT y estado de capacitación de los
            trabajadores).
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-heading text-lg font-bold uppercase tracking-wide">
            8. Cuánto tiempo conservamos tus datos
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Mientras dure tu relación laboral con la organización y, respecto de los registros de capacitación y
            certificados, por el plazo que exige la normativa de prevención de riesgos laborales, incluso después de
            que termine tu relación laboral. Los intentos fallidos de inicio de sesión se eliminan a las 24 horas.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-heading text-lg font-bold uppercase tracking-wide">9. Tus derechos</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Tienes derecho de acceso, rectificación, supresión, oposición, portabilidad y bloqueo de tus datos
            personales. Desde <span className="font-medium text-foreground">Mi perfil → Mis datos</span> puedes
            descargar una copia completa de tus datos y solicitar la baja de tu cuenta. Ten en cuenta que, mientras
            exista la obligación legal de conservar registros de capacitación (DS 44), esa solicitud no elimina
            dichos registros, aunque sí desactiva tu acceso a la plataforma. Para cualquier otra solicitud, incluida
            la revisión de tu estado de capacitación, usa los canales habituales de tu empresa (tu supervisor,
            recursos humanos u otro que tu empleador defina): tu empleador es el responsable de responderte. Si no
            recibes respuesta o no estás conforme, puedes reclamar ante la Agencia de Protección de Datos Personales.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-heading text-lg font-bold uppercase tracking-wide">10. Seguridad</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Tus datos se almacenan cifrados en reposo y se transmiten siempre mediante conexiones cifradas (HTTPS). El
            acceso a la información está restringido por rol y por organización.
          </p>
        </section>
      </div>
    </div>
  );
}
