import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { publicName } from "@/lib/people";
import { currentUser } from "@/server/auth";

/** "Entrar" o las iniciales del usuario. Lee la sesión: va dentro de un <Suspense>. */
export async function UserMenu() {
  const user = await currentUser();
  if (!user) {
    return (
      <Link href="/entrar" className="btn-ghost py-2 text-sm">
        <Icon name="user" className="size-4" />
        Entrar
      </Link>
    );
  }
  const name = publicName(user.name);
  return (
    <Link
      href="/cuenta"
      aria-label={`Tu cuenta (${name})`}
      title={name}
      className="grid size-10 place-items-center rounded-full bg-lime font-display text-sm font-black text-limeink transition hover:-translate-y-px hover:shadow-lift"
    >
      {initials(name)}
    </Link>
  );
}

export function UserMenuSkeleton() {
  return <span className="skeleton block size-10 rounded-full" aria-hidden="true" />;
}

function initials(name: string) {
  if (name === "Paciente") return <Icon name="user" className="size-4" />;
  return name
    .split(" ")
    .map((w) => w.charAt(0))
    .join("")
    .slice(0, 2);
}
