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
          <p className="text-sm text-muted-foreground mt-2">Última actualización: septiembre de 2026.</p>
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
          <h2 className="font-heading text-lg font-bold uppercase tracking-wide">5. Con quién se comparten</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Con tu empleador y quienes administran la capacitación dentro de tu organización. Quien escanee el código
            QR de tu credencial o de tu certificado ve tu nombre, RUT y estado de capacitación (y, en la credencial,
            tu cargo y centro de trabajo), igual que lo permitiría un documento físico, para efectos de
            fiscalización.
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
            6. Cuánto tiempo conservamos tus datos
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Mientras dure tu relación laboral con la organización y, respecto de los registros de capacitación y
            certificados, por el plazo que exige la normativa de prevención de riesgos laborales, incluso después de
            que termine tu relación laboral. Los intentos fallidos de inicio de sesión se eliminan a las 24 horas.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-heading text-lg font-bold uppercase tracking-wide">7. Tus derechos</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Tienes derecho de acceso, rectificación, supresión, oposición, portabilidad y bloqueo de tus datos
            personales. Desde <span className="font-medium text-foreground">Mi perfil → Mis datos</span> puedes
            descargar una copia completa de tus datos y solicitar la baja de tu cuenta. Ten en cuenta que, mientras
            exista la obligación legal de conservar registros de capacitación (DS 44), esa solicitud no elimina
            dichos registros, aunque sí desactiva tu acceso a la plataforma. Para cualquier otra solicitud, contacta
            a quien administra Capapp en tu organización, que es el responsable de responderte. Si no recibes
            respuesta o no estás conforme, puedes reclamar ante la Agencia de Protección de Datos Personales.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-heading text-lg font-bold uppercase tracking-wide">8. Seguridad</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Tus datos se almacenan cifrados en reposo y se transmiten siempre mediante conexiones cifradas (HTTPS). El
            acceso a la información está restringido por rol y por organización.
          </p>
        </section>
      </div>
    </div>
  );
}
