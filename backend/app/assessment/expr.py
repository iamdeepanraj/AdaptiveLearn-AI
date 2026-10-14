import ast
import operator
import math
from typing import Dict, Any, Union, Optional, Tuple
import logging

logger = logging.getLogger(__name__)

# Allowed operators in safe mathematical expressions
SAFE_OPERATORS = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.FloorDiv: operator.floordiv,
    ast.Mod: operator.mod,
    ast.Pow: operator.pow,
    ast.USub: operator.neg,
    ast.UAdd: operator.pos,
}

# Allowed math functions and constants
SAFE_FUNCTIONS = {
    "sqrt": math.sqrt,
    "abs": abs,
    "exp": math.exp,
    "log": math.log,
    "log10": math.log10,
    "sin": math.sin,
    "cos": math.cos,
    "tan": math.tan,
    "min": min,
    "max": max,
    "round": round,
    "pow": math.pow,
    "pi": math.pi,
    "e": math.e,
}

class SafeExpressionEvaluator:
    """
    Evaluates arithmetic and algebraic formula expressions safely using AST parsing.
    Prevents arbitrary code execution. Supports variables, powers, and standard math functions.
    """
    @classmethod
    def evaluate(cls, expression: str, params: Optional[Dict[str, float]] = None) -> float:
        """
        Safely evaluates expression given param values.
        Example: evaluate("0.5 * m * v**2", {"m": 2.0, "v": 3.0}) -> 9.0
        """
        params = params or {}
        try:
            node = ast.parse(expression.strip(), mode="eval").body
            return float(cls._eval_node(node, params))
        except Exception as e:
            logger.warning(f"SafeExpressionEvaluator failed for '{expression}' with {params}: {e}")
            raise ValueError(f"Could not safely evaluate expression '{expression}': {e}")

    @classmethod
    def _eval_node(cls, node: ast.AST, params: Dict[str, float]) -> Union[float, int]:
        if isinstance(node, ast.Constant):  # Python 3.8+ numeric literals
            if isinstance(node.value, (int, float)):
                return node.value
            raise ValueError(f"Unsupported constant type: {type(node.value)}")

        elif isinstance(node, ast.Name):
            # Parameter variable or math constant
            name = node.id
            if name in params:
                return float(params[name])
            if name in SAFE_FUNCTIONS and isinstance(SAFE_FUNCTIONS[name], (int, float)):
                return float(SAFE_FUNCTIONS[name])
            raise ValueError(f"Unknown variable in formula: '{name}'")

        elif isinstance(node, ast.BinOp):
            left = cls._eval_node(node.left, params)
            right = cls._eval_node(node.right, params)
            op_type = type(node.op)
            if op_type not in SAFE_OPERATORS:
                raise ValueError(f"Unsupported operator: {op_type}")
            # Guard against exponent blowup
            if op_type is ast.Pow and (right > 50 or right < -50):
                raise ValueError("Exponent too large for safe evaluation")
            return SAFE_OPERATORS[op_type](left, right)

        elif isinstance(node, ast.UnaryOp):
            operand = cls._eval_node(node.operand, params)
            op_type = type(node.op)
            if op_type not in SAFE_OPERATORS:
                raise ValueError(f"Unsupported unary operator: {op_type}")
            return SAFE_OPERATORS[op_type](operand)

        elif isinstance(node, ast.Call):
            if isinstance(node.func, ast.Name) and node.func.id in SAFE_FUNCTIONS:
                func = SAFE_FUNCTIONS[node.func.id]
                args = [cls._eval_node(arg, params) for arg in node.args]
                return float(func(*args))
            raise ValueError(f"Disallowed function call in expression: {getattr(node.func, 'id', 'unknown')}")

        raise ValueError(f"Disallowed AST expression construct: {type(node)}")

    @classmethod
    def verify_numerical_problem(
        cls,
        expression: str,
        params: Dict[str, float],
        stated_answer: float,
        tolerance: float = 0.02
    ) -> Tuple[bool, float, str]:
        """
        Recomputes the answer using the safe evaluator.
        Returns (is_valid, recomputed_answer, reason)
        """
        try:
            recomputed = cls.evaluate(expression, params)
            diff = abs(recomputed - stated_answer)
            allowed_error = max(1e-4, abs(recomputed) * tolerance)
            if diff <= allowed_error:
                return True, round(recomputed, 4), "Verified: Stated answer matches recomputed value."
            return False, round(recomputed, 4), f"Mismatch: Stated answer {stated_answer} differs from recomputed {round(recomputed, 4)}."
        except Exception as e:
            return False, 0.0, f"Expression evaluation failed: {e}"
