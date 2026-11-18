/** Finds circular dependencies between API business modules before they become runtime problems. */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import ts from 'typescript';

export function findModuleCycle(graph: ReadonlyMap<string, readonly string[]>): string[] | null {
  const complete = new Set<string>();
  const pending: string[] = [];
  function visit(name: string): string[] | null {
    const index = pending.indexOf(name);
    if (index >= 0) return [...pending.slice(index), name];
    if (complete.has(name)) return null;
    pending.push(name);
    for (const target of graph.get(name) ?? []) {
      const cycle = visit(target);
      if (cycle) return cycle;
    }
    pending.pop();
    complete.add(name);
    return null;
  }
  for (const name of graph.keys()) {
    const cycle = visit(name);
    if (cycle) return cycle;
  }
  return null;
}

export function readApiModuleGraph(directory: string): Map<string, string[]> {
  const graph = new Map<string, Set<string>>();
  const features = readdirSync(directory, { withFileTypes: true }).filter((entry) =>
    entry.isDirectory(),
  );
  for (const feature of features) graph.set(feature.name, new Set());
  function scan(folder: string, owner: string): void {
    for (const entry of readdirSync(folder, { withFileTypes: true })) {
      const filename = join(folder, entry.name);
      if (entry.isDirectory()) {
        scan(filename, owner);
        continue;
      }
      if (!entry.name.endsWith('.ts')) continue;
      const source = ts.createSourceFile(
        filename,
        readFileSync(filename, 'utf8'),
        ts.ScriptTarget.Latest,
        true,
      );
      for (const statement of source.statements) {
        if (!ts.isImportDeclaration(statement) && !ts.isExportDeclaration(statement)) continue;
        if (ts.isImportDeclaration(statement)) {
          const clause = statement.importClause;
          if (clause?.isTypeOnly) continue;
          if (
            clause?.namedBindings &&
            ts.isNamedImports(clause.namedBindings) &&
            !clause.name &&
            clause.namedBindings.elements.length &&
            clause.namedBindings.elements.every((item) => item.isTypeOnly)
          )
            continue;
        } else if (statement.isTypeOnly) continue;
        const specifier = statement.moduleSpecifier;
        if (!specifier || !ts.isStringLiteral(specifier) || !specifier.text.startsWith('.'))
          continue;
        const target = relative(directory, resolve(dirname(filename), specifier.text))
          .replaceAll('\\', '/')
          .split('/')[0];
        if (target && target !== owner && graph.has(target)) graph.get(owner)!.add(target);
      }
    }
  }
  for (const feature of features) scan(join(directory, feature.name), feature.name);
  return new Map([...graph].map(([name, targets]) => [name, [...targets].sort()]));
}
