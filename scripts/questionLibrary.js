// SAPIENCE LMS - COMPREHENSIVE QUESTION LIBRARY FOR SEEDER

// Helper to round numbers to 2 decimal places
const r2 = (num) => Math.round((num + Number.EPSILON) * 100) / 100;

// Helper to generate incorrect options for MCQ
const genIncorrectOptions = (correctVal, unit = "") => {
    return [
        { text: `${r2(correctVal * 1.5)} ${unit}`.trim(), isCorrect: false },
        { text: `${r2(correctVal * 0.5)} ${unit}`.trim(), isCorrect: false },
        { text: `${r2(correctVal + 5)} ${unit}`.trim(), isCorrect: false }
    ];
};

// 1. JEE Physics Mechanics Questions (30 questions)
export function getPhysicsMechanicsQuestions() {
    const list = [];
    
    // MCQs
    for (let i = 1; i <= 20; i++) {
        const mass = i * 2;
        const angle = i % 2 === 0 ? 30 : 45;
        const sinVal = angle === 30 ? 0.5 : 0.707;
        const accel = r2(9.8 * sinVal);
        
        list.push({
            question: `Q${i}: A block of mass ${mass} kg is placed on a frictionless inclined plane of angle ${angle}°. What is the acceleration of the block down the incline? (Take g = 9.8 m/s²)`,
            questionType: 'mcq',
            options: [
                { text: `${accel} m/s²`, isCorrect: true },
                ...genIncorrectOptions(accel, "m/s²")
            ],
            explanation: `Acceleration down a frictionless incline is given by a = g * sin(θ). Here, a = 9.8 * sin(${angle}°) = ${accel} m/s².`,
            points: 10,
            difficulty: i % 3 === 0 ? 'hard' : (i % 2 === 0 ? 'medium' : 'easy'),
            tags: ['mechanics', 'incline', 'kinematics']
        });
    }

    // Numerics
    for (let i = 21; i <= 26; i++) {
        const speed = i * 2;
        const range = r2((speed * speed * 0.866) / 9.8); // Range at 30 degrees (sin 60 = 0.866)
        list.push({
            question: `Q${i}: A projectile is launched from ground level with initial speed v = ${speed} m/s at an angle of 15° to the horizontal. Calculate its horizontal range in meters. (g = 9.8 m/s², round to 2 decimal places)`,
            questionType: 'numeric',
            numericAnswer: range,
            tolerance: 0.5,
            explanation: `Range R = (v² * sin(2θ)) / g. Here, R = (${speed}² * sin(30°)) / 9.8 = (${speed * speed} * 0.5) / 9.8 = ${range} meters.`,
            points: 10,
            difficulty: 'medium',
            tags: ['mechanics', 'projectile', 'kinematics']
        });
    }

    // Match the following
    list.push({
        question: `Q27: Match the mechanical devices with their principal coordinate forces:`,
        questionType: 'match_the_following',
        pairs: [
            { left: 'Simple Pendulum', right: 'Tension & Gravity' },
            { left: 'Block on Incline', right: 'Normal Force & Friction' },
            { left: 'Orbiting Satellite', right: 'Gravitational Pull' },
            { left: 'Spring-Mass System', right: 'Elastic Restoring Force' }
        ],
        explanation: 'Each system relies on unique principal physical forces to govern its equations of motion.',
        points: 10,
        difficulty: 'medium',
        tags: ['mechanics', 'forces']
    });

    list.push({
        question: `Q28: Match the rotational quantities with their corresponding SI units:`,
        questionType: 'match_the_following',
        pairs: [
            { left: 'Torque', right: 'N·m' },
            { left: 'Angular Momentum', right: 'kg·m²/s' },
            { left: 'Moment of Inertia', right: 'kg·m²' },
            { left: 'Angular Velocity', right: 'rad/s' }
        ],
        explanation: 'Standard rotational SI units defined by mechanical system dimensional analysis.',
        points: 10,
        difficulty: 'easy',
        tags: ['mechanics', 'rotational', 'units']
    });

    // Subjectives
    list.push({
        question: `Q29: Describe the physical significance of the parallel axis theorem and write its mathematical equation.`,
        questionType: 'subjective',
        idealAnswer: 'The parallel axis theorem states that the moment of inertia (I) of a body about any axis is equal to the sum of the moment of inertia about a parallel axis passing through its center of mass (I_cm) and the product of the mass of the body (M) and the square of the distance (d) between the two parallel axes: I = I_cm + Md².',
        explanation: 'Parallel axis theorem helps find moment of inertia for any axis parallel to a known axis through the center of mass.',
        points: 10,
        difficulty: 'medium',
        tags: ['rotational', 'derivation']
    });

    list.push({
        question: `Q30: State Newton's third law of motion and explain why action and reaction forces do not cancel each other.`,
        questionType: 'subjective',
        idealAnswer: 'Newton\'s third law states that for every action, there is an equal and opposite reaction. Action and reaction forces do not cancel each other because they act on two different bodies, not on the same body.',
        explanation: 'Forces can only cancel if they act on the same object. Action-reaction pairs act on different objects.',
        points: 10,
        difficulty: 'easy',
        tags: ['mechanics', 'newton']
    });

    return list;
}

// 2. MERN Backend Questions (25 questions)
export function getMernBackendQuestions() {
    const list = [];

    // MCQs
    const mcqData = [
        { q: "What does the Express middleware next() function do?", a: "Passes control to the next middleware", w: ["Sends response to client", "Terminates the request", "Logs the request"] },
        { q: "In MongoDB, which aggregation stage filters documents?", a: "$match", w: ["$project", "$group", "$sort"] },
        { q: "Which HTTP status code represents 'Internal Server Error'?", a: "500", w: ["400", "401", "404"] },
        { q: "Which method is used in Express to parse JSON request bodies?", a: "express.json()", w: ["express.urlencoded()", "express.static()", "express.router()"] },
        { q: "What is JWT stands for?", a: "JSON Web Token", w: ["Java Web Token", "JSON Web Transit", "Junction Web Technology"] },
        { q: "Which HTTP method is typically used to update an existing resource completely?", a: "PUT", w: ["GET", "POST", "PATCH"] },
        { q: "Which mongoose schema option automatically adds createdAt and updatedAt fields?", a: "timestamps: true", w: ["timefields: true", "logs: true", "history: true"] },
        { q: "How do you define a route parameter in an Express route path?", a: "/users/:id", w: ["/users/id", "/users?id", "/users[id]"] },
        { q: "Which Node.js module is used to hash user passwords securely?", a: "bcryptjs", w: ["crypto", "hashjs", "md5"] },
        { q: "What is MongoDB's primary model type?", a: "Document-oriented", w: ["Relational", "Graph-based", "Key-value"] },
        { q: "Which environment variable is typically used to store database connection URIs?", a: "MONGODB_URI", w: ["DB_PORT", "DATABASE_NAME", "URL_CONN"] },
        { q: "In Node.js, what does npm stand for?", a: "Node Package Manager", w: ["Node Program Module", "Network Package Manager", "Node Project Manager"] },
        { q: "Which Express function mounts middleware globally?", a: "app.use()", w: ["app.get()", "app.set()", "app.mount()"] },
        { q: "What is the purpose of the CORS middleware?", a: "Enable cross-origin resource sharing", w: ["Cache request responses", "Encrypt route bodies", "Compress server responses"] },
        { q: "Which MongoDB method is used to insert multiple documents at once?", a: "insertMany()", w: ["insert()", "insertOne()", "createMany()"] }
    ];

    mcqData.forEach((d, idx) => {
        list.push({
            question: `Q${idx+1}: ${d.q}`,
            questionType: 'mcq',
            options: [
                { text: d.a, isCorrect: true },
                ...d.w.map(o => ({ text: o, isCorrect: false }))
            ],
            explanation: `The correct answer is ${d.a}.`,
            points: 10,
            difficulty: idx % 3 === 0 ? 'medium' : 'easy',
            tags: ['express', 'node', 'mongodb', 'mern']
        });
    });

    // Numerics
    const numData = [
        { q: "What is the default port number for MongoDB?", a: 27017 },
        { q: "What is the default port number for Express development server when set by create-react-app (commonly)?", a: 3000 },
        { q: "What is the HTTP status code for 'Unauthorized' access?", a: 401 },
        { q: "What is the HTTP status code for 'Created' status?", a: 201 },
        { q: "What is the default number of salt rounds recommended for bcrypt password hashing?", a: 10 }
    ];

    numData.forEach((d, idx) => {
        list.push({
            question: `Q${idx+16}: ${d.q}`,
            questionType: 'numeric',
            numericAnswer: d.a,
            tolerance: 0,
            explanation: `The standard answer is ${d.a}.`,
            points: 10,
            difficulty: 'easy',
            tags: ['express', 'mongodb', 'security']
        });
    });

    // Match the following
    list.push({
        question: `Q21: Match the HTTP status code with its meaning:`,
        questionType: 'match_the_following',
        pairs: [
            { left: '200', right: 'OK' },
            { left: '400', right: 'Bad Request' },
            { left: '403', right: 'Forbidden' },
            { left: '404', right: 'Not Found' }
        ],
        explanation: 'Standard HTTP response codes specify client/server outcomes.',
        points: 10,
        difficulty: 'easy',
        tags: ['http', 'network']
    });

    list.push({
        question: `Q22: Match the MERN stack component with its category:`,
        questionType: 'match_the_following',
        pairs: [
            { left: 'MongoDB', right: 'NoSQL Database' },
            { left: 'Express', right: 'Backend Framework' },
            { left: 'React', right: 'Frontend Library' },
            { left: 'Node', right: 'JS Runtime' }
        ],
        explanation: 'Component architecture roles within the MERN framework.',
        points: 10,
        difficulty: 'easy',
        tags: ['mern', 'architecture']
    });

    // Subjectives
    list.push({
        question: `Q23: Explain what middleware is in Express.js and give an example.`,
        questionType: 'subjective',
        idealAnswer: 'Middleware in Express.js is a function that has access to the request object (req), response object (res), and the next middleware function in the application\'s request-response cycle. It can execute code, modify request/response objects, end cycles, and invoke the next function. Example: app.use(express.json()) to parse body content.',
        explanation: 'Middleware acts as a pipeline filter intercepting HTTP requests before route handlers.',
        points: 10,
        difficulty: 'medium',
        tags: ['express', 'middleware']
    });

    list.push({
        question: `Q24: What is the difference between SQL and NoSQL databases?`,
        questionType: 'subjective',
        idealAnswer: 'SQL databases are relational, table-based, use structured query language, and have predefined schemas (e.g., PostgreSQL). NoSQL databases are non-relational, document or key-value based, have dynamic schemas, and scale horizontally (e.g., MongoDB).',
        explanation: 'SQL focuses on schema structure and ACID compliance; NoSQL focus is scalability and schema flexibility.',
        points: 10,
        difficulty: 'medium',
        tags: ['databases', 'architecture']
    });

    list.push({
        question: `Q25: Explain the purpose of JSON Web Tokens (JWT) and how they are structured.`,
        questionType: 'subjective',
        idealAnswer: 'JWT is an open standard for securely transmitting information as a JSON object. It is used for stateless authentication. It has three parts separated by dots: Header (metadata + algorithm), Payload (claims/user data), and Signature (secret verification).',
        explanation: 'JWT allows servers to verify client authentication without storing session data on the backend.',
        points: 10,
        difficulty: 'hard',
        tags: ['security', 'jwt']
    });

    return list;
}

// 3. JEE Maths Limits & Derivatives (30 questions)
export function getMathsLimitsQuestions() {
    const list = [];

    // MCQs
    for (let i = 1; i <= 20; i++) {
        const factor = i * 2;
        list.push({
            question: `Q${i}: Evaluate the limit: lim_{x -> 0} [sin(${factor}x) / x]`,
            questionType: 'mcq',
            options: [
                { text: `${factor}`, isCorrect: true },
                { text: '1', isCorrect: false },
                { text: '0', isCorrect: false },
                { text: `Undefined`, isCorrect: false }
            ],
            explanation: `Using the formula lim_{u -> 0} [sin(u) / u] = 1, we rewrite lim [${factor} * sin(${factor}x) / (${factor}x)] = ${factor} * 1 = ${factor}.`,
            points: 10,
            difficulty: i % 3 === 0 ? 'hard' : 'easy',
            tags: ['limits', 'calculus']
        });
    }

    // Numerics
    for (let i = 21; i <= 26; i++) {
        const coef = i - 15; // 6 to 11
        const derivAt2 = coef * 4; // f(x) = coef * x^2 => f'(x) = 2 * coef * x => f'(2) = 4 * coef
        list.push({
            question: `Q${i}: If f(x) = ${coef}x², calculate the derivative value f'(2).`,
            questionType: 'numeric',
            numericAnswer: derivAt2,
            tolerance: 0,
            explanation: `f'(x) = 2 * ${coef} * x = ${2 * coef}x. Thus f'(2) = ${2 * coef} * 2 = ${derivAt2}.`,
            points: 10,
            difficulty: 'easy',
            tags: ['derivative', 'calculus']
        });
    }

    // Match the following
    list.push({
        question: `Q27: Match the function with its derivative:`,
        questionType: 'match_the_following',
        pairs: [
            { left: 'sin(x)', right: 'cos(x)' },
            { left: 'cos(x)', right: '-sin(x)' },
            { left: 'tan(x)', right: 'sec²(x)' },
            { left: 'ln(x)', right: '1/x' }
        ],
        explanation: 'Standard derivative formulas for transcendental functions.',
        points: 10,
        difficulty: 'easy',
        tags: ['calculus', 'derivatives']
    });

    list.push({
        question: `Q28: Match the limit forms with their standard rules:`,
        questionType: 'match_the_following',
        pairs: [
            { left: '0/0 form', right: "L'Hopital's Rule" },
            { left: '(1 + x)^(1/x) as x->0', right: 'e' },
            { left: 'sin(x)/x as x->0', right: '1' },
            { left: '(e^x - 1)/x as x->0', right: '1' }
        ],
        explanation: 'Limits standard evaluation criteria.',
        points: 10,
        difficulty: 'medium',
        tags: ['calculus', 'limits']
    });

    // Subjectives
    list.push({
        question: `Q29: State the formal definition of limit continuity at a point x = c.`,
        questionType: 'subjective',
        idealAnswer: 'A function f(x) is continuous at a point x = c if: 1. f(c) is defined, 2. lim_{x -> c} f(x) exists, and 3. lim_{x -> c} f(x) = f(c).',
        explanation: 'Continuity requires the limit to equal the function value at that point.',
        points: 10,
        difficulty: 'medium',
        tags: ['limits', 'continuity']
    });

    list.push({
        question: `Q30: Prove that the derivative of e^(2x) is 2e^(2x) using the first principle of derivatives.`,
        questionType: 'subjective',
        idealAnswer: 'f\'(x) = lim_{h->0} [f(x+h) - f(x)]/h = lim_{h->0} [e^(2x+2h) - e^(2x)]/h = e^(2x) * lim_{h->0} [e^(2h) - 1]/h. Since lim_{h->0} [e^(2h) - 1]/(2h) = 1, we multiply and divide by 2 to get f\'(x) = 2e^(2x) * 1 = 2e^(2x).',
        explanation: 'First principles apply algebraic limit rules to delta evaluations.',
        points: 10,
        difficulty: 'hard',
        tags: ['calculus', 'derivatives', 'proof']
    });

    return list;
}

// 4. NEET Biology Genetics (35 questions)
export function getBiologyGeneticsQuestions() {
    const list = [];

    // MCQs
    for (let i = 1; i <= 25; i++) {
        const isMendelian = i % 2 === 0;
        list.push({
            question: `Q${i}: ${isMendelian ? "Which Mendelian ratio represents a typical dihybrid cross in F2 generation?" : "Which cell organelle is considered the site of protein translation?"}`,
            questionType: 'mcq',
            options: isMendelian ? [
                { text: '9:3:3:1', isCorrect: true },
                { text: '3:1', isCorrect: false },
                { text: '1:2:1', isCorrect: false },
                { text: '9:7', isCorrect: false }
            ] : [
                { text: 'Ribosome', isCorrect: true },
                { text: 'Mitochondria', isCorrect: false },
                { text: 'Golgi body', isCorrect: false },
                { text: 'Nucleus', isCorrect: false }
            ],
            explanation: isMendelian ? "Dihybrid F2 phenotypic ratio is 9:3:3:1." : "Ribosomes synthesize proteins under mRNA direction.",
            points: 10,
            difficulty: i % 3 === 0 ? 'medium' : 'easy',
            tags: ['biology', 'genetics', 'cell']
        });
    }

    // Numerics
    for (let i = 26; i <= 31; i++) {
        const autosomes = i * 2;
        const total = autosomes + 2;
        list.push({
            question: `Q${i}: A diploid organism has ${autosomes} autosomes. How many total chromosomes does its somatic cell contain?`,
            questionType: 'numeric',
            numericAnswer: total,
            tolerance: 0,
            explanation: `Somatic cells contain autosomes plus 2 sex chromosomes. Total = ${autosomes} + 2 = ${total}.`,
            points: 10,
            difficulty: 'easy',
            tags: ['genetics', 'chromosomes']
        });
    }

    // Match the following
    list.push({
        question: `Q32: Match the genetic terms with their definitions:`,
        questionType: 'match_the_following',
        pairs: [
            { left: 'Genotype', right: 'Genetic makeup of an organism' },
            { left: 'Phenotype', right: 'Physical expression of a trait' },
            { left: 'Allele', right: 'Alternative form of a gene' },
            { left: 'Homozygous', right: 'Having identical alleles for a gene' }
        ],
        explanation: 'Genetics definitions matching.',
        points: 10,
        difficulty: 'easy',
        tags: ['genetics', 'terminology']
    });

    list.push({
        question: `Q33: Match the bases of DNA with their correct pairing partner:`,
        questionType: 'match_the_following',
        pairs: [
            { left: 'Adenine', right: 'Thymine' },
            { left: 'Cytosine', right: 'Guanine' },
            { left: 'Guanine', right: 'Cytosine' },
            { left: 'Thymine', right: 'Adenine' }
        ],
        explanation: 'Watson-Crick base pairing rules.',
        points: 10,
        difficulty: 'easy',
        tags: ['biology', 'dna']
    });

    // Subjectives
    list.push({
        question: `Q34: State and explain Mendel's Law of Segregation.`,
        questionType: 'subjective',
        idealAnswer: 'Mendel\'s Law of Segregation states that during gamete formation, the alleles for each gene segregate from each other so that each gamete carries only one allele for each gene. Offspring thus inherit one allele from each parent.',
        explanation: 'Segregation ensures gametes are haploid for each allele.',
        points: 10,
        difficulty: 'medium',
        tags: ['genetics', 'mendel']
    });

    list.push({
        question: `Q35: Explain the difference between transcription and translation.`,
        questionType: 'subjective',
        idealAnswer: 'Transcription is the process of copying a segment of DNA into RNA (specifically mRNA), occurring in the nucleus. Translation is the process where ribosomes synthesize proteins using the mRNA sequence as a template, occurring in the cytoplasm.',
        explanation: 'Central dogma stages involve DNA->RNA (transcription) and RNA->Protein (translation).',
        points: 10,
        difficulty: 'medium',
        tags: ['molecular', 'genetics']
    });

    return list;
}

// 5. DSA Trees & Graphs (25 questions)
export function getDsaTreesQuestions() {
    const list = [];

    // MCQs
    const mcqs = [
        { q: "What is the worst-case time complexity of searching in a skewed Binary Search Tree (BST)?", a: "O(N)", w: ["O(log N)", "O(N log N)", "O(1)"] },
        { q: "Which graph traversal algorithm uses a Queue data structure?", a: "BFS", w: ["DFS", "Dijkstra", "Kruskal"] },
        { q: "What data structure is typically used to implement Depth First Search (DFS)?", a: "Stack", w: ["Queue", "Priority Queue", "Array"] },
        { q: "Which algorithm is used to find the shortest path in a weighted graph with positive weights?", a: "Dijkstra's", w: ["Prim's", "Kruskal's", "Floyd-Warshall"] },
        { q: "In a min-heap, where is the minimum element located?", a: "Root node", w: ["Leaf node", "Middle node", "Right-most node"] },
        { q: "What is the height of a balanced BST with N nodes?", a: "O(log N)", w: ["O(N)", "O(1)", "O(N²)"] },
        { q: "What is a tree with no cycles called?", a: "Acyclic graph", w: ["Cyclic graph", "Complete graph", "Directed graph"] },
        { q: "Which traversal of a BST yields sorted elements in ascending order?", a: "In-order", w: ["Pre-order", "Post-order", "Level-order"] },
        { q: "What is the maximum number of children a binary tree node can have?", a: "2", w: ["1", "3", "Unlimited"] },
        { q: "What is the topological sort of a cyclic graph?", a: "Does not exist", w: ["Sorted order", "BFS order", "DFS order"] },
        { q: "Which algorithm finds the Minimum Spanning Tree using a greedy approach on edges?", a: "Kruskal's", w: ["Dijkstra's", "Bellman-Ford", "Floyd-Warshall"] },
        { q: "What is the space complexity of BFS on a graph with V vertices?", a: "O(V)", w: ["O(1)", "O(E)", "O(V²)"] },
        { q: "Which of the following is a self-balancing binary search tree?", a: "AVL Tree", w: ["Binary Heap", "Trie", "Huffman Tree"] },
        { q: "Which data structure is used to check connectivity in Kruskal's algorithm?", a: "Disjoint Set Union", w: ["Stack", "Queue", "Heap"] },
        { q: "What does a leaf node in a tree represent?", a: "A node with no children", w: ["The top-most node", "A node with only one child", "A root node"] }
    ];

    mcqs.forEach((d, idx) => {
        list.push({
            question: `Q${idx+1}: ${d.q}`,
            questionType: 'mcq',
            options: [
                { text: d.a, isCorrect: true },
                ...d.w.map(o => ({ text: o, isCorrect: false }))
            ],
            explanation: `The correct answer is ${d.a}.`,
            points: 10,
            difficulty: idx % 3 === 0 ? 'hard' : (idx % 2 === 0 ? 'medium' : 'easy'),
            tags: ['dsa', 'trees', 'graphs']
        });
    });

    // Numerics
    for (let i = 16; i <= 20; i++) {
        const leafNodes = i * 2;
        const totalNullPtrs = leafNodes * 2; // In binary tree, leaf nodes have 2 null pointers each
        list.push({
            question: `Q${i}: A binary tree has ${leafNodes} leaf nodes. How many null pointers do these leaf nodes contain in total?`,
            questionType: 'numeric',
            numericAnswer: totalNullPtrs,
            tolerance: 0,
            explanation: `Each leaf node has exactly 2 null children. So total null pointers = ${leafNodes} * 2 = ${totalNullPtrs}.`,
            points: 10,
            difficulty: 'easy',
            tags: ['dsa', 'trees']
        });
    }

    // Match the following
    list.push({
        question: `Q21: Match the graph algorithm with its primary objective:`,
        questionType: 'match_the_following',
        pairs: [
            { left: "Dijkstra's", right: 'Single-source Shortest Path' },
            { left: "Kruskal's", right: 'Minimum Spanning Tree' },
            { left: 'Kahn\'s', right: 'Topological Sorting' },
            { left: 'Kosaraju\'s', right: 'Strongly Connected Components' }
        ],
        explanation: 'Standard graph algorithms and objectives mapping.',
        points: 10,
        difficulty: 'medium',
        tags: ['dsa', 'graphs']
    });

    list.push({
        question: `Q22: Match the tree traversal with its processing order:`,
        questionType: 'match_the_following',
        pairs: [
            { left: 'Pre-order', right: 'Root -> Left -> Right' },
            { left: 'In-order', right: 'Left -> Root -> Right' },
            { left: 'Post-order', right: 'Left -> Right -> Root' },
            { left: 'Level-order', right: 'Breadth First Search' }
        ],
        explanation: 'Standard traversal orders.',
        points: 10,
        difficulty: 'easy',
        tags: ['dsa', 'trees']
    });

    // Subjectives
    list.push({
        question: `Q23: Describe the property of a Binary Search Tree (BST).`,
        questionType: 'subjective',
        idealAnswer: 'For any node N in a Binary Search Tree, all nodes in N\'s left subtree have values less than N\'s value, and all nodes in N\'s right subtree have values greater than N\'s value.',
        explanation: 'BST property enables logarithmic lookup, insertion, and deletion times.',
        points: 10,
        difficulty: 'easy',
        tags: ['dsa', 'trees']
    });

    list.push({
        question: `Q24: What is the difference between BFS and DFS?`,
        questionType: 'subjective',
        idealAnswer: 'BFS (Breadth First Search) explores vertices layer by layer (level order), using a Queue. DFS (Depth First Search) goes as deep as possible along each branch before backtracking, using a Stack or recursion.',
        explanation: 'BFS is optimal for shortest paths in unweighted graphs; DFS is optimal for path-finding and connectivity checks.',
        points: 10,
        difficulty: 'medium',
        tags: ['dsa', 'graphs']
    });

    list.push({
        question: `Q25: Explain the concept of topological sorting in Directed Acyclic Graphs (DAGs).`,
        questionType: 'subjective',
        idealAnswer: 'Topological sorting is a linear ordering of vertices in a DAG such that for every directed edge u -> v, vertex u comes before v in the ordering. It is only possible if the graph has no cycles.',
        explanation: 'Topological sort is used for task scheduling and resolving dependencies.',
        points: 10,
        difficulty: 'hard',
        tags: ['dsa', 'graphs']
    });

    return list;
}

// 6. React Performance Optimization (25 questions)
export function getReactPerformanceQuestions() {
    const list = [];

    // MCQs
    const mcqs = [
        { q: "Which React hook is used to memoize a computed value between renders?", a: "useMemo", w: ["useCallback", "useRef", "useEffect"] },
        { q: "Which hook memoizes a callback function definition?", a: "useCallback", w: ["useMemo", "useState", "useContext"] },
        { q: "What component wrap prevents a functional component from re-rendering on identical props?", a: "React.memo", w: ["React.useMemo", "React.Fragment", "React.StrictMode"] },
        { q: "What is the purpose of React.lazy()?", a: "Code splitting / lazy loading", w: ["State management", "Virtual DOM updates", "Form validation"] },
        { q: "Which Chrome DevTools panel helps profile React component re-renders?", a: "Profiler", w: ["Console", "Network", "Elements"] },
        { q: "Which hook should be avoided if you want to prevent component re-renders on value change?", a: "useState", w: ["useRef", "useMemo", "useCallback"] },
        { q: "What is key prop used for in lists?", a: "Help React identify which items have changed", w: ["Styling elements", "Adding event handlers", "State binding"] },
        { q: "What happens when you call a state setter function with the same state value?", a: "React bails out without re-rendering", w: ["Force refresh", "Throws an error", "Triggers infinite loop"] },
        { q: "Which library is popular for rendering very long lists efficiently (virtualization)?", a: "react-window", w: ["redux", "axios", "framer-motion"] },
        { q: "What does code-splitting reduce?", a: "Initial bundle size", w: ["State variables", "HTML elements", "Server routes"] },
        { q: "Which tool analyzes bundle sizes in Next.js/Vite?", a: "Webpack Bundle Analyzer", w: ["Eslint", "Nodemon", "Prettier"] },
        { q: "What is the default behavior of React on parent component state changes?", a: "Re-renders parent and all children", w: ["Re-renders parent only", "Does nothing", "Re-renders children only"] },
        { q: "What is the primary risk of using inline objects in dependency arrays?", a: "Unnecessary re-renders", w: ["Memory leak", "Syntax error", "Data corruption"] },
        { q: "What component is used to wrap React.lazy components to show fallback loading?", a: "Suspense", w: ["ErrorBoundary", "Provider", "Consumer"] },
        { q: "Which React 18 feature allows splitting state updates into urgent and non-urgent?", a: "useTransition", w: ["useDeferredValue", "useId", "useSyncExternalStore"] }
    ];

    mcqs.forEach((d, idx) => {
        list.push({
            question: `Q${idx+1}: ${d.q}`,
            questionType: 'mcq',
            options: [
                { text: d.a, isCorrect: true },
                ...d.w.map(o => ({ text: o, isCorrect: false }))
            ],
            explanation: `The correct answer is ${d.a}.`,
            points: 10,
            difficulty: idx % 3 === 0 ? 'medium' : 'easy',
            tags: ['react', 'performance']
        });
    });

    // Numerics
    for (let i = 16; i <= 20; i++) {
        const renders = i * 3;
        list.push({
            question: `Q${i}: A component renders ${renders} times in a profile session. If 1/3 of the renders are unnecessary due to parent state updates, how many clean renders occurred?`,
            questionType: 'numeric',
            numericAnswer: renders * 2 / 3,
            tolerance: 0,
            explanation: `Clean renders = ${renders} - (${renders} / 3) = ${renders * 2 / 3}.`,
            points: 10,
            difficulty: 'easy',
            tags: ['react', 'profiling']
        });
    }

    // Match the following
    list.push({
        question: `Q21: Match the React api with its optimization role:`,
        questionType: 'match_the_following',
        pairs: [
            { left: 'useMemo', right: 'Memoize expensive computations' },
            { left: 'useCallback', right: 'Memoize function references' },
            { left: 'React.memo', right: 'Prevent functional component re-renders' },
            { left: 'Suspense', right: 'Wrap lazy-loaded components' }
        ],
        explanation: 'React optimization tools.',
        points: 10,
        difficulty: 'easy',
        tags: ['react', 'apis']
    });

    list.push({
        question: `Q22: Match the tool/pattern with its description:`,
        questionType: 'match_the_following',
        pairs: [
            { left: 'Code Splitting', right: 'Splitting bundle into smaller chunks' },
            { left: 'List Virtualization', right: 'Rendering only visible list items' },
            { left: 'Debouncing', right: 'Delaying action execution' },
            { left: 'Lighthouse', right: 'Auditing page performance' }
        ],
        explanation: 'General front-end web optimization techniques.',
        points: 10,
        difficulty: 'medium',
        tags: ['web', 'optimization']
    });

    // Subjectives
    list.push({
        question: `Q23: Explain the difference between useMemo and useCallback.`,
        questionType: 'subjective',
        idealAnswer: 'useMemo calls its function and returns the memoized result of that computation, whereas useCallback returns the memoized function reference itself without calling it.',
        explanation: 'useMemo returns a value; useCallback returns a function.',
        points: 10,
        difficulty: 'medium',
        tags: ['react', 'hooks']
    });

    list.push({
        question: `Q24: What is list virtualization and why is it important?`,
        questionType: 'subjective',
        idealAnswer: 'List virtualization (or windowing) is a technique where only the items currently visible in the viewport are rendered in the DOM, rather than rendering the entire list of thousands of items. This saves DOM nodes and CPU cycles.',
        explanation: 'Virtualization keeps the DOM small and improves scrolling frame rate.',
        points: 10,
        difficulty: 'medium',
        tags: ['web', 'rendering']
    });

    list.push({
        question: `Q25: How does React\'s reconciliation algorithm work when keys are provided?`,
        questionType: 'subjective',
        idealAnswer: 'React uses keys to match children in the original tree with children in the subsequent tree. If a key matches, React moves the existing DOM node instead of deleting and recreating it, significantly speeding up list updates.',
        explanation: 'Keys provide stable identities to list elements across renders.',
        points: 10,
        difficulty: 'hard',
        tags: ['react', 'reconciliation']
    });

    return list;
}

// 7. JEE Physics Electromagnetism (30 questions)
export function getPhysicsElectroQuestions() {
    const list = [];

    // MCQs
    for (let i = 1; i <= 20; i++) {
        const cap = i * 5;
        const voltage = i % 2 === 0 ? 10 : 20;
        const energy = r2(0.5 * cap * 1e-6 * voltage * voltage * 1000); // in mJ
        list.push({
            question: `Q${i}: A capacitor of capacitance ${cap} μF is connected to a ${voltage} V battery. Calculate the electrostatic energy stored in it in millijoules (mJ).`,
            questionType: 'mcq',
            options: [
                { text: `${energy} mJ`, isCorrect: true },
                ...genIncorrectOptions(energy, "mJ")
            ],
            explanation: `Stored energy E = 0.5 * C * V² = 0.5 * (${cap} * 10⁻⁶ F) * ${voltage}² V² = ${0.5 * cap * 1e-6 * voltage * voltage} Joules = ${energy} mJ.`,
            points: 10,
            difficulty: i % 3 === 0 ? 'hard' : 'easy',
            tags: ['electrostatics', 'capacitors']
        });
    }

    // Numerics
    for (let i = 21; i <= 26; i++) {
        const area = i * 2;
        const cap = r2((8.85 * area) / 2); // C = e0 * A / d. d=2mm, e0=8.85e-12. cap in pF
        list.push({
            question: `Q${i}: Calculate the capacitance (in pF) of a parallel plate capacitor in vacuum with plate area A = ${area} m² and plate separation d = 2.0 mm. (Take ε₀ = 8.85 × 10⁻¹² F/m)`,
            questionType: 'numeric',
            numericAnswer: cap,
            tolerance: 1.0,
            explanation: `C = ε₀ * A / d = (8.85 × 10⁻¹² * ${area}) / (2 × 10⁻³) = ${cap} × 10⁻¹² F = ${cap} pF.`,
            points: 10,
            difficulty: 'medium',
            tags: ['electrostatics', 'capacitance']
        });
    }

    // Match the following
    list.push({
        question: `Q27: Match the electromagnetism laws with their definitions:`,
        questionType: 'match_the_following',
        pairs: [
            { left: 'Gauss\'s Law', right: 'Total electric flux equals enclosed charge divided by ε₀' },
            { left: 'Coulomb\'s Law', right: 'Force between two charges is inversely proportional to r²' },
            { left: 'Ampere\'s Law', right: 'Line integral of B around a closed loop is μ₀ * I' },
            { left: 'Faraday\'s Law', right: 'Induced EMF equals rate of change of magnetic flux' }
        ],
        explanation: 'Fundamental laws of electromagnetism.',
        points: 10,
        difficulty: 'medium',
        tags: ['electromagnetism', 'laws']
    });

    list.push({
        question: `Q28: Match the physical unit with the quantity:`,
        questionType: 'match_the_following',
        pairs: [
            { left: 'Farad', right: 'Capacitance' },
            { left: 'Tesla', right: 'Magnetic Field Strength' },
            { left: 'Henry', right: 'Inductance' },
            { left: 'Weber', right: 'Magnetic Flux' }
        ],
        explanation: 'SI units for electrodynamic parameters.',
        points: 10,
        difficulty: 'easy',
        tags: ['electromagnetism', 'units']
    });

    // Subjectives
    list.push({
        question: `Q29: Explain the concept of electric potential energy of a system of two point charges.`,
        questionType: 'subjective',
        idealAnswer: 'The electric potential energy of a system of two point charges q₁ and q₂ separated by distance r is the work done in bringing the charges from infinity to their respective positions, given by U = (1 / 4πε₀) * (q₁q₂ / r).',
        explanation: 'Work done against electrostatic forces is stored as system potential energy.',
        points: 10,
        difficulty: 'medium',
        tags: ['electrostatics', 'potential']
    });

    list.push({
        question: `Q30: State Lenz\'s law and explain how it complies with the law of conservation of energy.`,
        questionType: 'subjective',
        idealAnswer: 'Lenz\'s law states that the direction of induced current is such that it opposes the change in magnetic flux that produced it. If it did not oppose it, the induced current would create an assisting field, increasing flux and energy indefinitely without external work, which violates conservation of energy.',
        explanation: 'Lenz\'s law is a direct consequence of the conservation of energy applied to electromagnetic induction.',
        points: 10,
        difficulty: 'hard',
        tags: ['induction', 'lenz', 'conservation']
    });

    return list;
}

// 8. JEE Physics Thermodynamics (30 questions)
export function getPhysicsThermoQuestions() {
    const list = [];

    // MCQs
    for (let i = 1; i <= 20; i++) {
        const tempC = i * 5;
        const tempK = tempC + 273.15;
        list.push({
            question: `Q${i}: Convert ${tempC}°C to Kelvin (K).`,
            questionType: 'mcq',
            options: [
                { text: `${tempK} K`, isCorrect: true },
                { text: `${tempC} K`, isCorrect: false },
                { text: `${tempC + 100} K`, isCorrect: false },
                { text: `${tempC * 1.8 + 32} K`, isCorrect: false }
            ],
            explanation: `T(K) = T(°C) + 273.15 = ${tempC} + 273.15 = ${tempK} K.`,
            points: 10,
            difficulty: 'easy',
            tags: ['thermodynamics', 'temperature']
        });
    }

    // Numerics
    for (let i = 21; i <= 26; i++) {
        const tHot = (i + 10) * 10; // 310 to 360 K
        const tCold = 300;
        const efficiency = r2((1 - tCold / tHot) * 100); // Carnot efficiency in %
        list.push({
            question: `Q${i}: A Carnot heat engine operates between temperatures TH = ${tHot} K and TC = 300 K. Calculate its thermal efficiency in percentage (%). (Round to 2 decimal places)`,
            questionType: 'numeric',
            numericAnswer: efficiency,
            tolerance: 0.5,
            explanation: `Carnot efficiency η = (1 - TC / TH) * 100 = (1 - 300 / ${tHot}) * 100 = ${efficiency}%.`,
            points: 10,
            difficulty: 'medium',
            tags: ['thermodynamics', 'carnot', 'engine']
        });
    }

    // Match the following
    list.push({
        question: `Q27: Match the thermodynamic process with its description:`,
        questionType: 'match_the_following',
        pairs: [
            { left: 'Isothermal', right: 'Constant Temperature' },
            { left: 'Adiabatic', right: 'No Heat Exchange' },
            { left: 'Isobaric', right: 'Constant Pressure' },
            { left: 'Isochoric', right: 'Constant Volume' }
        ],
        explanation: 'Basic definitions of thermodynamic pathways.',
        points: 10,
        difficulty: 'easy',
        tags: ['thermodynamics', 'processes']
    });

    list.push({
        question: `Q28: Match the state quantities with their standard equations (for 1 mole of ideal gas):`,
        questionType: 'match_the_following',
        pairs: [
            { left: 'Ideal Gas Law', right: 'PV = RT' },
            { left: 'First Law of Thermodynamics', right: 'ΔU = Q - W' },
            { left: 'Work done in Isobaric process', right: 'W = PΔV' },
            { left: 'Adiabatic process equation', right: 'PV^γ = Constant' }
        ],
        explanation: 'Primary thermodynamics formulas.',
        points: 10,
        difficulty: 'medium',
        tags: ['thermodynamics', 'equations']
    });

    // Subjectives
    list.push({
        question: `Q29: State the First Law of Thermodynamics and describe its relationship with conservation of energy.`,
        questionType: 'subjective',
        idealAnswer: 'The First Law of Thermodynamics states that the change in internal energy (ΔU) of a closed system is equal to the heat added to the system (Q) minus the work done by the system (W): ΔU = Q - W. This is a direct statement of the law of conservation of energy applied to thermal systems.',
        explanation: 'Energy cannot be created or destroyed, only transferred as heat or work.',
        points: 10,
        difficulty: 'medium',
        tags: ['thermodynamics', 'laws']
    });

    list.push({
        question: `Q30: State the Second Law of Thermodynamics (both Clausius and Kelvin-Planck statements).`,
        questionType: 'subjective',
        idealAnswer: 'Kelvin-Planck: It is impossible to construct a heat engine that operates in a cycle and produces no other effect than the extraction of heat from a reservoir and performance of an equivalent amount of work. Clausius: It is impossible to construct a device that operates in a cycle and produces no other effect than the transfer of heat from a cooler body to a warmer body.',
        explanation: 'Entropy must increase in spontaneous processes, ruling out perpetual motion engines.',
        points: 10,
        difficulty: 'hard',
        tags: ['thermodynamics', 'laws', 'entropy']
    });

    return list;
}

// 9. JEE Maths Integration & Area (40 questions)
export function getMathsIntegrationQuestions() {
    const list = [];

    // MCQs
    for (let i = 1; i <= 30; i++) {
        const coef = i + 1;
        const answerVal = r2((coef * coef) / 2); // integral of coef * x from 0 to coef => [coef * x^2/2] = coef^3/2 - 0
        list.push({
            question: `Q${i}: Evaluate the definite integral: \u222b_{0}^{${coef}} (${coef}x) dx`,
            questionType: 'mcq',
            options: [
                { text: `${r2((coef * coef * coef) / 2)}`, isCorrect: true },
                { text: `${coef}`, isCorrect: false },
                { text: `${coef * coef}`, isCorrect: false },
                { text: '0', isCorrect: false }
            ],
            explanation: `\u222b (${coef}x) dx = [${coef}x²/2] from 0 to ${coef} = ${coef} * (${coef})² / 2 - 0 = ${coef * coef * coef / 2}.`,
            points: 10,
            difficulty: i % 3 === 0 ? 'hard' : (i % 2 === 0 ? 'medium' : 'easy'),
            tags: ['calculus', 'integration']
        });
    }

    // Numerics
    for (let i = 31; i <= 36; i++) {
        const power = i - 29; // 2 to 7
        const val = r2(1 / (power + 1)); // integral of x^power from 0 to 1
        list.push({
            question: `Q${i}: Calculate the definite integral value: \u222b_{0}^{1} x^{${power}} dx. (Round to 2 decimal places)`,
            questionType: 'numeric',
            numericAnswer: val,
            tolerance: 0.05,
            explanation: `\u222b x^n dx = [x^{n+1}/(n+1)] from 0 to 1 = 1/(${power}+1) = ${val}.`,
            points: 10,
            difficulty: 'easy',
            tags: ['calculus', 'integration']
        });
    }

    // Match the following
    list.push({
        question: `Q37: Match the integral with its standard solution formula:`,
        questionType: 'match_the_following',
        pairs: [
            { left: '\u222b x^n dx', right: 'x^(n+1)/(n+1) + C' },
            { left: '\u222b 1/x dx', right: 'ln|x| + C' },
            { left: '\u222b e^x dx', right: 'e^x + C' },
            { left: '\u222b sec²(x) dx', right: 'tan(x) + C' }
        ],
        explanation: 'Fundamental indefinite integration formulas.',
        points: 10,
        difficulty: 'easy',
        tags: ['calculus', 'integration']
    });

    list.push({
        question: `Q38: Match the properties of definite integrals (assuming f(x) is even or odd):`,
        questionType: 'match_the_following',
        pairs: [
            { left: '\u222b_{-a}^{a} f(x) dx (f is odd)', right: '0' },
            { left: '\u222b_{-a}^{a} f(x) dx (f is even)', right: '2 * \u222b_{0}^{a} f(x) dx' },
            { left: '\u222b_{a}^{b} f(x) dx', right: '-\u222b_{b}^{a} f(x) dx' },
            { left: '\u222b_{a}^{b} f(x) dx + \u222b_{b}^{c} f(x) dx', right: '\u222b_{a}^{c} f(x) dx' }
        ],
        explanation: 'Mathematical definite integral properties.',
        points: 10,
        difficulty: 'medium',
        tags: ['calculus', 'integration']
    });

    // Subjectives
    list.push({
        question: `Q39: State the Fundamental Theorem of Calculus.`,
        questionType: 'subjective',
        idealAnswer: 'The Fundamental Theorem of Calculus consists of two parts. Part 1 states that if F(x) is defined by F(x) = \u222b_{a}^{x} f(t) dt, then F\'(x) = f(x). Part 2 states that if F is an antiderivative of f, then \u222b_{a}^{b} f(x) dx = F(b) - F(a).',
        explanation: 'Differentiation and integration are inverse operations.',
        points: 10,
        difficulty: 'medium',
        tags: ['calculus', 'integration']
    });

    list.push({
        question: `Q40: Formulate the integration by parts rule and explain its origin.`,
        questionType: 'subjective',
        idealAnswer: 'The integration by parts rule is \u222b u dv = uv - \u222b v du. It originates from the product rule of differentiation: d(uv) = u dv + v du. Integrating both sides yields uv = \u222b u dv + \u222b v du, which rearranges to the integration by parts formula.',
        explanation: 'Integration by parts is the reverse of the product rule for derivatives.',
        points: 10,
        difficulty: 'hard',
        tags: ['calculus', 'integration', 'parts']
    });

    return list;
}

// 10. JEE Maths Quadratic Equations (35 questions)
export function getMathsQuadraticQuestions() {
    const list = [];

    // MCQs
    for (let i = 1; i <= 25; i++) {
        const rootsSum = i;
        const rootsProd = i * 2;
        list.push({
            question: `Q${i}: Find the quadratic equation whose sum of roots is ${rootsSum} and product of roots is ${rootsProd}.`,
            questionType: 'mcq',
            options: [
                { text: `x² - ${rootsSum}x + ${rootsProd} = 0`, isCorrect: true },
                { text: `x² + ${rootsSum}x + ${rootsProd} = 0`, isCorrect: false },
                { text: `x² - ${rootsSum}x - ${rootsProd} = 0`, isCorrect: false },
                { text: `x² + ${rootsSum}x - ${rootsProd} = 0`, isCorrect: false }
            ],
            explanation: `A quadratic equation is given by x² - (sum of roots)x + (product of roots) = 0. So here it is x² - ${rootsSum}x + ${rootsProd} = 0.`,
            points: 10,
            difficulty: i % 3 === 0 ? 'medium' : 'easy',
            tags: ['quadratic', 'roots']
        });
    }

    // Numerics
    for (let i = 26; i <= 31; i++) {
        const coef = i - 20; // 6 to 11
        const disc = coef * coef - 16; // b^2 - 4ac. a=1, b=coef, c=4
        list.push({
            question: `Q${i}: Calculate the discriminant (D) of the quadratic equation: x² + ${coef}x + 4 = 0.`,
            questionType: 'numeric',
            numericAnswer: disc,
            tolerance: 0,
            explanation: `Discriminant D = b² - 4ac = (${coef})² - 4(1)(4) = ${coef * coef} - 16 = ${disc}.`,
            points: 10,
            difficulty: 'easy',
            tags: ['quadratic', 'discriminant']
        });
    }

    // Match the following
    list.push({
        question: `Q32: Match the discriminant values with the nature of roots:`,
        questionType: 'match_the_following',
        pairs: [
            { left: 'D > 0', right: 'Real and Distinct' },
            { left: 'D = 0', right: 'Real and Equal' },
            { left: 'D < 0', right: 'Imaginary' },
            { left: 'D is perfect square (integer coefficients)', right: 'Rational and Distinct' }
        ],
        explanation: 'Determinant characteristics determine roots morphology.',
        points: 10,
        difficulty: 'easy',
        tags: ['quadratic', 'roots']
    });

    list.push({
        question: `Q33: Match the Vieta's relations for ax² + bx + c = 0:`,
        questionType: 'match_the_following',
        pairs: [
            { left: 'Sum of roots (α + β)', right: '-b/a' },
            { left: 'Product of roots (α * β)', right: 'c/a' },
            { left: 'Sum of squares of roots (α² + β²)', right: '(b² - 2ac)/a²' },
            { left: 'Difference of roots |α - β|', right: '√(D)/|a|' }
        ],
        explanation: 'Vieta\'s relationships link coefficients with root sums and products.',
        points: 10,
        difficulty: 'medium',
        tags: ['quadratic', 'roots']
    });

    // Subjectives
    list.push({
        question: `Q34: Derive the quadratic formula x = [-b ± √(b² - 4ac)] / 2a by completing the square method.`,
        questionType: 'subjective',
        idealAnswer: 'Start with ax² + bx + c = 0. Divide by a: x² + (b/a)x + c/a = 0. Complete the square: (x + b/2a)² - (b/2a)² + c/a = 0. Move terms: (x + b/2a)² = b²/4a² - c/a = (b² - 4ac)/4a². Take square root: x + b/2a = ±√(b² - 4ac)/2a. Rearranging gives: x = [-b ± √(b² - 4ac)] / 2a.',
        explanation: 'Completing the square yields the universal quadratic formula roots extraction.',
        points: 10,
        difficulty: 'medium',
        tags: ['quadratic', 'derivation']
    });

    list.push({
        question: `Q35: Explain the location of roots theorem for a quadratic expression f(x) = ax² + bx + c to have both roots greater than a real number k (assuming a > 0).`,
        questionType: 'subjective',
        idealAnswer: 'For both roots of f(x) to be greater than k (with a > 0): 1. Discriminant D ≥ 0 (roots must be real), 2. The vertex x-coordinate -b/2a > k, and 3. The function value at k, f(k) > 0.',
        explanation: 'Location of roots rules define spatial bounds on quadratic graphs.',
        points: 10,
        difficulty: 'hard',
        tags: ['quadratic', 'roots', 'graphs']
    });

    return list;
}

// 11. Generic Tutor Question Bank questions (100+ questions)
export function getGenericQuestionBankQuestions(vikramId, snehaId, arjunId, kavitaId, rohanId, meeraId) {
    const questions = [];

    // Let's seed 20 questions for each of the 6 tutors.
    const subjects = [
        { tutorId: vikramId, name: 'Physics', tags: ['mechanics', 'incline', 'gravity'], qPrefix: 'Physics Mechanics Challenge' },
        { tutorId: vikramId, name: 'Mathematics', tags: ['limits', 'integration', 'algebra'], qPrefix: 'Mathematics Calculus Drill' },
        { tutorId: snehaId, name: 'Chemistry', tags: ['organic', 'complexes', 'coordination'], qPrefix: 'Chemistry Mechanism Review' },
        { tutorId: snehaId, name: 'Biology', tags: ['genetics', 'physiology', 'cell'], qPrefix: 'Biology Anatomy Assessment' },
        { tutorId: arjunId, name: 'Web Development', tags: ['express', 'node', 'mongodb'], qPrefix: 'Full Stack MERN Practice' },
        { tutorId: kavitaId, name: 'Computer Science', tags: ['dsa', 'trees', 'graphs'], qPrefix: 'Algorithms & Structures Test' },
        { tutorId: rohanId, name: 'Design', tags: ['ui-ux', 'figma', 'css'], qPrefix: 'UI/UX Design Concept' },
        { tutorId: meeraId, name: 'Data Science & ML', tags: ['python', 'ml', 'pandas'], qPrefix: 'Machine Learning Foundation' }
    ];

    let qId = 1;
    subjects.forEach((subj) => {
        for (let i = 1; i <= 15; i++) {
            const isMCQ = i % 2 === 0;
            const points = i % 3 === 0 ? 5 : (i % 2 === 0 ? 2 : 4);
            const difficulty = i % 3 === 0 ? 'hard' : (i % 2 === 0 ? 'medium' : 'easy');
            
            if (isMCQ) {
                questions.push({
                    tutorId: subj.tutorId,
                    type: 'mcq',
                    question: `${subj.qPrefix} Q${i}: What is the correct standard approach to solve a typical ${subj.name} problem on ${subj.tags[0]}?`,
                    options: [
                        { text: 'Analyze constraints, write equations, solve.', isCorrect: true },
                        { text: 'Guess option by checking dimensional formulas.', isCorrect: false },
                        { text: 'Consult documentation files before processing.', isCorrect: false },
                        { text: 'Skip and move to easier questions.', isCorrect: false }
                    ],
                    explanation: 'Standard scientific and technical problem-solving method.',
                    points,
                    difficulty,
                    tags: subj.tags
                });
            } else {
                questions.push({
                    tutorId: subj.tutorId,
                    type: 'subjective',
                    question: `${subj.qPrefix} Q${i}: Explain the foundational principles governing ${subj.tags[1] || subj.tags[0]} in the field of ${subj.name}.`,
                    idealAnswer: `The core principles of ${subj.tags[1] || subj.tags[0]} require understanding conservation rules, structure, and operational characteristics unique to ${subj.name} applications.`,
                    explanation: `Deep dive into conceptual and theoretical background of ${subj.tags[1] || subj.tags[0]}.`,
                    points,
                    difficulty,
                    tags: subj.tags
                });
            }
            qId++;
        }
    });

    return questions;
}
