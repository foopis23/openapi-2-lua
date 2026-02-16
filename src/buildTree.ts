export type OpenApiPathsObject = Record<string, Record<string, unknown>>;

export type MethodData = {
	fullPath: string;
	pathParams: string[];
	operation: unknown;
};

export type MethodsMap = Record<string, MethodData>;

// Tree nodes are plain objects keyed by path segment.
// Each segment key maps to { children, methods }. The "children" object may also contain __methods.
export type PathTreeNode = {
	__methods?: MethodsMap;
	[key: string]: any;
};

export function buildPathTree(paths: OpenApiPathsObject): PathTreeNode {
	const root: PathTreeNode = {};

	for (const [fullPath, methods] of Object.entries(paths)) {
		const segments = fullPath
			.replace(/^\//, "")
			.split("/")
			.filter(Boolean);

		insertPath(root, segments, methods, fullPath);
	}

	return root;
}

function insertPath(root: PathTreeNode, segments: string[], methods: Record<string, unknown>, fullPath: string) {
	let current: PathTreeNode = root;
	const pathParams: string[] = [];

	for (const segment of segments) {
		const paramMatch = segment.match(/^{(.+)}$/);

		if (paramMatch) {
			pathParams.push(paramMatch[1]!);
			continue;
		}

		if (!current[segment]) {
			current[segment] = {
				children: {},
				methods: {}
			};
		}

		current = current[segment].children;
	}

	if (!current.__methods) current.__methods = {};

	for (const [method, operation] of Object.entries(methods)) {
		current.__methods[method] = {
			fullPath,
			pathParams,
			operation
		};
	}
}
