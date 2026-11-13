export function Screen({ id, title, body }: { id: string; title: string; body: string }) {
  return (
    <section>
      <p className="screen-id">{id}</p>
      <h1>{title}</h1>
      <p className="lede">{body}</p>
    </section>
  );
}
