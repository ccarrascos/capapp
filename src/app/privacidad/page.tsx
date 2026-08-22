import Link from "next/link";
import { ShieldHalf } from "lucide-react";

export default function PoliticaPrivacidadPage() {
  return (
    <div className="min-h-dvh bg-background px-6 py-12">
      <div className="mx-auto max-w-2xl flex flex-col gap-8">
        <Link href="/login" className="flex items-center gap-2.5 w-fit">
          <span className="flex size-8 items-center justify-center rounded-sm bg-primary text-primary-foreground">
            <ShieldHalf className="size-4.5" strokeWidth={2.4} />
          </span>
          <span className="font-heading text-lg tracking-wide uppercase">Capapp</span>
        </Link>

        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Ley N.º 21.719</p>
          <h1 className="font-heading text-3xl font-bold uppercase tracking-tight mt-1">
            Política de privacidad
          </h1>
          <p className="text-sm text-muted-foreground mt-2">Última actualización: agosto de 2026.</p>
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
            <li>Identificación: RUT, nombres, apellidos, fecha de nacimiento.</li>
            <li>Contacto: correo electrónico, teléfono.</li>
            <li>Datos laborales: cargo, modalidad contractual, organización y centro de trabajo.</li>
            <li>
              Datos de capacitación: inscripciones, asistencia por módulo, evaluaciones, certificados y su fecha de
              vigencia.
            </li>
            <li>Credenciales de acceso a la plataforma (tu contraseña se almacena cifrada; nunca en texto plano).</li>
          </ul>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-heading text-lg font-bold uppercase tracking-wide">
            3. Para qué usamos tus datos
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Exclusivamente para gestionar y acreditar tu capacitación en prevención de riesgos laborales conforme al
            artículo 16 del DS N.º 44/2023, incluyendo la emisión de certificados y el cálculo de su vigencia. La
            fecha de nacimiento se usa además para elaborar reportes de cumplimiento por rango etario.
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
            Con tu empleador y quienes administran la capacitación dentro de tu organización. El número de
            certificado (sin tu RUT completo visible salvo para quien escanea el código) puede validarse
            públicamente, igual que lo permite un certificado físico, para efectos de fiscalización.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-heading text-lg font-bold uppercase tracking-wide">
            6. Cuánto tiempo conservamos tus datos
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Mientras dure tu relación laboral con la organización y, respecto de los registros de capacitación y
            certificados, por el plazo que exige la normativa de prevención de riesgos laborales, incluso después de
            que termine tu relación laboral.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-heading text-lg font-bold uppercase tracking-wide">7. Tus derechos</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Puedes solicitar acceso, rectificación, cancelación, oposición o portabilidad de tus datos personales.
            Desde <span className="font-medium text-foreground">Mi perfil → Mis datos</span> puedes descargar una
            copia de tus datos y solicitar la baja de tu cuenta. Ten en cuenta que, mientras exista la obligación
            legal de conservar registros de capacitación (DS 44), esa solicitud no elimina dichos registros, aunque sí
            desactiva tu acceso a la plataforma. Para cualquier otra solicitud, contacta a quien administra Capapp en
            tu organización.
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
