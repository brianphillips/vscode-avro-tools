import { Tree, KeyValuePair } from '../syntaxtree';
import { Token, StringToken } from '../parsing';

export enum ValidationSeverity {
	Error,
	Warning
}

export class ValidationMessage {
	severity: ValidationSeverity
	start: number
	end: number
	message: string

	constructor(severity: ValidationSeverity, start: number, end: number, message: string) {
		this.severity = severity;
		this.start = start;
		this.end = end;
		this.message = message;
	}
}

export interface Validator {
	validate(tree: Tree): ValidationMessage[];

}

export class ExpectedAttributesValidator implements Validator {
	validate(tree: Tree): ValidationMessage[] {
		const result: ValidationMessage[] = [];

		const nodeStart = (tree.node.leftBracket !== null) ? tree.node.leftBracket.position : 0;
		const nodeEnd = (tree.node.rightBracket !== null)
			? tree.node.rightBracket.position + tree.node.rightBracket.value.length
			: nodeStart + 1;
		const typeMissing = this.expectedAttribute(tree.node.children, '"type"', nodeStart, nodeEnd);
		if (typeMissing !== null) {
			result.push(typeMissing);
		}
		else {
			const type = tree.node.children.find(kv => kv.key !== null && kv.key.value === '"type"');

			if (type instanceof KeyValuePair && type.value instanceof StringToken && type.value.value === '"record"') {
				const typeKey = type.key as StringToken;
				const nameMissing = this.expectedAttribute(tree.node.children, '"name"', typeKey.position, type.value.length + type.value.position);
				if (nameMissing !== null) {
					result.push(nameMissing);
				}

				const fieldsMissing = this.expectedAttribute(tree.node.children, '"fields"', typeKey.position, type.value.length + type.value.position);
				if (fieldsMissing !== null) {
					result.push(fieldsMissing);
				}
			}
		}

		return result;
	}

	expectedAttribute(attributes: KeyValuePair[], name: string, messageStart: number, messageEnd: number): ValidationMessage | null {
		let hasFields = false;
		attributes.forEach((kv) => {
			if (kv.key !== null && kv.key.value === name) {
				hasFields = true;
			}
		});

		if (!hasFields) {
			return new ValidationMessage(
				ValidationSeverity.Error,
				messageStart,
				messageEnd,
				'Attribute ' + name + ' is missing');
		}

		return null;
	}
}