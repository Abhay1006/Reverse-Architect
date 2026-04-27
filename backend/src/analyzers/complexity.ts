import { Node, SyntaxKind } from 'ts-morph';

/**
 * Calculates a simplified cyclomatic complexity for a given function or method node.
 * 
 * Formula: 1 + number of decision points (if, while, for, case, catch, logical ops, ternaries).
 */
export function calculateComplexity(node: Node): number {
  let complexity = 1;

  // Decision points to count
  const decisionKinds = [
    SyntaxKind.IfStatement,
    SyntaxKind.ForStatement,
    SyntaxKind.ForInStatement,
    SyntaxKind.ForOfStatement,
    SyntaxKind.WhileStatement,
    SyntaxKind.DoStatement,
    SyntaxKind.CaseClause,
    SyntaxKind.CatchClause,
    SyntaxKind.ConditionalExpression, // Ternary operator
    SyntaxKind.AmpersandAmpersandToken, // &&
    SyntaxKind.BarBarToken, // ||
    SyntaxKind.QuestionQuestionToken, // ??
  ];

  // Count occurrences of these kinds in the node's descendants
  for (const kind of decisionKinds) {
    complexity += node.getDescendantsOfKind(kind).length;
  }

  return complexity;
}
