import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import User from '../src/models/User.js';
import Tutor from '../src/models/Tutor.js';
import Course from '../src/models/Course.js';
import Topic from '../src/models/Topic.js';
import Skill from '../src/models/Skill.js';
import Question from '../src/models/Question.js';
import ScheduleAppointment from '../src/models/Appointment_Schedule.js';
import Appointment from '../src/models/Appointment.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/tutorapp';

async function run() {
    try {
        console.log('🔄 Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected.');

        // 1. Fetch Tutors
        console.log('\n👤 Fetching Tutors from database...');
        const vikramUser = await User.findOne({ email: 'vikram@apexacademy.in' });
        if (!vikramUser) throw new Error('Tutor vikram@apexacademy.in not found');
        const vikramTutor = await Tutor.findOne({ userId: vikramUser._id });
        if (!vikramTutor) throw new Error('Tutor profile not found for Vikram');
        console.log(`✅ Found Vikram Rathore (Tutor ID: ${vikramTutor._id})`);

        const snehaUser = await User.findOne({ email: 'sneha@apexacademy.in' });
        if (!snehaUser) throw new Error('Tutor sneha@apexacademy.in not found');
        const snehaTutor = await Tutor.findOne({ userId: snehaUser._id });
        if (!snehaTutor) throw new Error('Tutor profile not found for Sneha');
        console.log(`✅ Found Sneha Iyer (Tutor ID: ${snehaTutor._id})`);

        // 2. Fetch Courses
        console.log('\n📚 Fetching Courses...');
        const physicsCourse = await Course.findOne({ tutorId: vikramTutor._id, title: 'Physics Crash Course 2026' });
        const mathsCourse = await Course.findOne({ tutorId: vikramTutor._id, title: 'Mathematics — Calculus & Algebra Mastery' });
        const biologyCourse = await Course.findOne({ tutorId: snehaTutor._id, title: 'Biology Masterclass 2026' });
        const chemistryCourse = await Course.findOne({ tutorId: snehaTutor._id, title: 'Chemistry — Organic Mechanisms & Coordination Compounds' });

        console.log(`- Physics Course: ${physicsCourse ? 'Found (' + physicsCourse._id + ')' : 'NOT found'}`);
        console.log(`- Mathematics Course: ${mathsCourse ? 'Found (' + mathsCourse._id + ')' : 'NOT found'}`);
        console.log(`- Biology Course: ${biologyCourse ? 'Found (' + biologyCourse._id + ')' : 'NOT found'}`);
        console.log(`- Chemistry Course: ${chemistryCourse ? 'Found (' + chemistryCourse._id + ')' : 'NOT found'}`);

        // 3. Seed Skills (unique constraint on name)
        console.log('\n🛠️ Seeding Skills (Taxonomy)...');
        const skillsToSeed = [
            {
                name: 'Problem Solving',
                description: 'Ability to apply theoretical formulas and principles to solve numerical or algorithmic problems.',
                tutorId: vikramTutor._id
            },
            {
                name: 'Analytical Thinking',
                description: 'Ability to break down complex physical scenarios or abstract mathematical theorems into logical parts.',
                tutorId: vikramTutor._id
            },
            {
                name: 'Conceptual Understanding',
                description: 'Deep understanding of physical principles, biological cycles, chemical structures, and mathematical definitions.',
                tutorId: vikramTutor._id
            },
            {
                name: 'Derivation & Logical Proof',
                description: 'Ability to derive scientific equations or prove mathematical theorems step-by-step.',
                tutorId: vikramTutor._id
            },
            {
                name: 'Observation & Diagram Analysis',
                description: 'Interpreting biological structures, chemical reactions, and diagrammatic representations.',
                tutorId: snehaTutor._id
            }
        ];

        const skillMap = {}; // name -> Skill doc
        for (const s of skillsToSeed) {
            const skillDoc = await Skill.findOneAndUpdate(
                { name: s.name },
                { $set: s },
                { upsert: true, new: true }
            );
            skillMap[s.name] = skillDoc;
            console.log(`✅ Seeded Skill: ${skillDoc.name} (${skillDoc._id})`);
        }

        // 4. Seed Topics (unique constraint on { name, tutorId })
        console.log('\n📂 Seeding Topics (Taxonomy)...');
        const topicsToSeed = [
            // Vikram Physics Topics
            {
                name: 'Newtonian Mechanics',
                description: "Newton's laws of motion, inertia, action-reaction, friction, and constraint relations.",
                tutorId: vikramTutor._id,
                courseId: physicsCourse?._id
            },
            {
                name: 'Thermodynamics',
                description: 'Laws of thermodynamics, heat engines, entropy, and thermodynamic processes.',
                tutorId: vikramTutor._id,
                courseId: physicsCourse?._id
            },
            {
                name: 'Electrostatics',
                description: "Coulomb's law, electric field, potential, Gauss's law, and capacitors.",
                tutorId: vikramTutor._id,
                courseId: physicsCourse?._id
            },
            // Vikram Maths Topics
            {
                name: 'Calculus & Integrals',
                description: 'Limits, continuity, derivatives, definite and indefinite integrals, and area under curves.',
                tutorId: vikramTutor._id,
                courseId: mathsCourse?._id
            },
            {
                name: 'Quadratic Equations',
                description: 'Roots of quadratic equations, nature of roots, and relation between roots and coefficients.',
                tutorId: vikramTutor._id,
                courseId: mathsCourse?._id
            },
            // Sneha Chemistry Topics
            {
                name: 'Organic Mechanisms',
                description: 'Reaction intermediates, substitution and elimination pathways, nucleophilic attacks.',
                tutorId: snehaTutor._id,
                courseId: chemistryCourse?._id
            },
            {
                name: 'Coordination Compounds',
                description: 'Ligands, coordination number, isomerism, crystal field theory, and magnetic properties.',
                tutorId: snehaTutor._id,
                courseId: chemistryCourse?._id
            },
            // Sneha Biology Topics
            {
                name: 'Genetics & Inheritance',
                description: 'Mendelian genetics, chromosome inheritance, gene mapping, cell division, and molecular biology.',
                tutorId: snehaTutor._id,
                courseId: biologyCourse?._id
            },
            {
                name: 'Human Physiology',
                description: 'Digestion, breathing and respiration, circulation, excretion, locomotion, and neural control.',
                tutorId: snehaTutor._id,
                courseId: biologyCourse?._id
            }
        ];

        const topicMap = {}; // name -> Topic doc
        for (const t of topicsToSeed) {
            const topicDoc = await Topic.findOneAndUpdate(
                { name: t.name, tutorId: t.tutorId },
                { $set: t },
                { upsert: true, new: true }
            );
            topicMap[t.name] = topicDoc;
            console.log(`✅ Seeded Topic: ${topicDoc.name} (${topicDoc._id})`);
        }

        // 5. Seed Questions (unique constraint on { question, tutorId })
        console.log('\n📝 Seeding Questions in Question Bank...');
        const questionsToSeed = [
            // --- PHYSICS QUESTIONS (Vikram) ---
            {
                tutorId: vikramTutor._id,
                type: 'mcq',
                question: 'A block of mass 5 kg is placed on a rough horizontal surface with coefficient of static friction \u03bc_s = 0.4. A horizontal force of 15 N is applied. What is the friction force acting on the block? (Take g = 10 m/s\u00b2)',
                options: [
                    { text: '15 N', isCorrect: true },
                    { text: '20 N', isCorrect: false },
                    { text: '0 N', isCorrect: false },
                    { text: '10 N', isCorrect: false }
                ],
                explanation: 'The maximum static friction is f_{s,max} = \u03bc_s * N = 0.4 * (5 * 10) = 20 N. Since the applied force (15 N) is less than the maximum static friction, the block does not move, and the static friction force exactly balances the applied force. Hence, f_s = 15 N.',
                difficulty: 'medium',
                points: 4,
                tags: ['mechanics', 'friction', 'newton'],
                topicId: topicMap['Newtonian Mechanics']?._id,
                skillId: skillMap['Problem Solving']?._id
            },
            {
                tutorId: vikramTutor._id,
                type: 'mcq',
                question: 'Which of the following processes has zero net heat exchange with the surroundings (Q = 0)?',
                options: [
                    { text: 'Adiabatic process', isCorrect: true },
                    { text: 'Isothermal process', isCorrect: false },
                    { text: 'Isobaric process', isCorrect: false },
                    { text: 'Isochoric process', isCorrect: false }
                ],
                explanation: 'An adiabatic process is defined as one in which there is no heat transfer into or out of the system, i.e., Q = 0.',
                difficulty: 'easy',
                points: 2,
                tags: ['thermodynamics', 'heat', 'adiabatic'],
                topicId: topicMap['Thermodynamics']?._id,
                skillId: skillMap['Conceptual Understanding']?._id
            },
            {
                tutorId: vikramTutor._id,
                type: 'subjective',
                question: "State Newton's Second Law of Motion and derive the relation F = ma for a body of constant mass.",
                idealAnswer: "Newton's Second Law states that the rate of change of momentum of a body is directly proportional to the applied force and takes place in the direction of the force.\n\nMomentum p = mv.\nForce F \u221d dp/dt  => F = k * d(mv)/dt.\nIf mass m is constant, F = k * m * (dv/dt) = k * ma.\nIn SI units, the constant k is defined as 1, yielding F = ma.",
                explanation: 'The derivative of momentum with respect to time leads directly to F = ma, assuming mass remains constant.',
                difficulty: 'medium',
                points: 5,
                tags: ['mechanics', 'newton', 'derivation'],
                topicId: topicMap['Newtonian Mechanics']?._id,
                skillId: skillMap['Derivation & Logical Proof']?._id
            },
            {
                tutorId: vikramTutor._id,
                type: 'subjective',
                question: 'Explain the concept of electric field shielding inside a hollow spherical conductor under electrostatic equilibrium.',
                idealAnswer: 'Under electrostatic equilibrium, the net charge inside a hollow spherical conductor resides entirely on its outer surface. According to Gauss\'s Law, drawing any spherical Gaussian surface inside the cavity yields an enclosed charge of zero. Therefore, the electric field E is zero everywhere inside the cavity, effectively shielding the interior from external electric fields.',
                explanation: 'Gauss\'s Law proves that the electric field inside a closed conducting cavity is zero, regardless of external charges.',
                difficulty: 'hard',
                points: 6,
                tags: ['electrostatics', 'gauss', 'shielding'],
                topicId: topicMap['Electrostatics']?._id,
                skillId: skillMap['Analytical Thinking']?._id
            },

            // --- MATHEMATICS QUESTIONS (Vikram) ---
            {
                tutorId: vikramTutor._id,
                type: 'mcq',
                question: 'Evaluate the limit: lim_{x -> 0} [sin(5x) / x]',
                options: [
                    { text: '5', isCorrect: true },
                    { text: '1', isCorrect: false },
                    { text: '0', isCorrect: false },
                    { text: 'Undefined', isCorrect: false }
                ],
                explanation: 'Using the standard trigonometric limit lim_{\u03b8 -> 0} [sin(\u03b8) / \u03b8] = 1, rewrite the expression as 5 * [sin(5x) / 5x]. As x -> 0, 5x -> 0, so the limit is 5 * 1 = 5.',
                difficulty: 'easy',
                points: 2,
                tags: ['limits', 'calculus'],
                topicId: topicMap['Calculus & Integrals']?._id,
                skillId: skillMap['Problem Solving']?._id
            },
            {
                tutorId: vikramTutor._id,
                type: 'mcq',
                question: 'Find the nature of the roots of the quadratic equation: 3x\u00b2 - 4\u221a3x + 4 = 0',
                options: [
                    { text: 'Real and equal', isCorrect: true },
                    { text: 'Real and distinct', isCorrect: false },
                    { text: 'Imaginary', isCorrect: false },
                    { text: 'No roots exist', isCorrect: false }
                ],
                explanation: 'The discriminant D = b\u00b2 - 4ac = (-4\u221a3)\u00b2 - 4 * 3 * 4 = 48 - 48 = 0. Since D = 0, the quadratic equation has real and equal roots.',
                difficulty: 'medium',
                points: 4,
                tags: ['quadratic', 'roots', 'discriminant'],
                topicId: topicMap['Quadratic Equations']?._id,
                skillId: skillMap['Conceptual Understanding']?._id
            },
            {
                tutorId: vikramTutor._id,
                type: 'subjective',
                question: 'Evaluate the definite integral: \u222b_{0}^{\u03c0/2} [sin(x) / (sin(x) + cos(x))] dx',
                idealAnswer: "Let I = \u222b_{0}^{\u03c0/2} [sin(x) / (sin(x) + cos(x))] dx.  --(Equation 1)\nUsing the property \u222b_{a}^{b} f(x) dx = \u222b_{a}^{b} f(a+b-x) dx:\nI = \u222b_{0}^{\u03c0/2} [sin(\u03c0/2 - x) / (sin(\u03c0/2 - x) + cos(\u03c0/2 - x))] dx\nI = \u222b_{0}^{\u03c0/2} [cos(x) / (cos(x) + sin(x))] dx.  --(Equation 2)\nAdding Equation 1 and Equation 2:\n2I = \u222b_{0}^{\u03c0/2} [(sin(x) + cos(x)) / (sin(x) + cos(x))] dx = \u222b_{0}^{\u03c0/2} 1 dx = [x]_{0}^{\u03c0/2} = \u03c0/2.\nTherefore, I = \u03c0/4.",
                explanation: 'Applying the definite integral property (King\'s Rule) simplifies the sum of the integrands to 1, making the integration straightforward.',
                difficulty: 'hard',
                points: 5,
                tags: ['calculus', 'integration', 'definite-integral'],
                topicId: topicMap['Calculus & Integrals']?._id,
                skillId: skillMap['Problem Solving']?._id
            },
            {
                tutorId: vikramTutor._id,
                type: 'subjective',
                question: 'Prove that the roots of the equation: (x-a)(x-b) + (x-b)(x-c) + (x-c)(x-a) = 0 are always real, and can be equal only if a = b = c.',
                idealAnswer: "Expanding and grouping terms, we get the quadratic equation:\n3x\u00b2 - 2(a+b+c)x + (ab+bc+ca) = 0.\n\nIts discriminant is:\nD = B\u00b2 - 4AC = [-2(a+b+c)]\u00b2 - 4 * 3 * (ab+bc+ca)\nD = 4(a\u00b2 + b\u00b2 + c\u00b2 + 2ab + 2bc + 2ca) - 12(ab + bc + ca)\nD = 4(a\u00b2 + b\u00b2 + c\u00b2 - ab - bc - ca)\nD = 2 * [ (a-b)\u00b2 + (b-c)\u00b2 + (c-a)\u00b2 ]\n\nSince the sum of squares of real numbers is always non-negative (\u2265 0), D \u2265 0, proving the roots are always real. Additionally, roots are equal only when D = 0, which occurs if and only if (a-b) = 0, (b-c) = 0, and (c-a) = 0, which means a = b = c.",
                explanation: 'Re-arranging the discriminant into a sum of squares demonstrates that D >= 0 is always true, ensuring real roots.',
                difficulty: 'hard',
                points: 6,
                tags: ['quadratic', 'proof', 'roots'],
                topicId: topicMap['Quadratic Equations']?._id,
                skillId: skillMap['Derivation & Logical Proof']?._id
            },

            // --- CHEMISTRY QUESTIONS (Sneha) ---
            {
                tutorId: snehaTutor._id,
                type: 'mcq',
                question: 'What is the coordination number of Cobalt in the complex ion [Co(en)\u2083]\u00b3\u207a?',
                options: [
                    { text: '6', isCorrect: true },
                    { text: '3', isCorrect: false },
                    { text: '4', isCorrect: false },
                    { text: '12', isCorrect: false }
                ],
                explanation: 'Ethylenediamine (en) is a bidentate ligand. As three bidentate ligands bind to Cobalt, the coordination number is 3 * 2 = 6.',
                difficulty: 'medium',
                points: 4,
                tags: ['chemistry', 'coordination', 'complex'],
                topicId: topicMap['Coordination Compounds']?._id,
                skillId: skillMap['Problem Solving']?._id
            },
            {
                tutorId: snehaTutor._id,
                type: 'subjective',
                question: 'Explain the difference between S_N1 and S_N2 reaction mechanisms regarding kinetics and stereochemical outcome.',
                idealAnswer: "S_N1 (Substitution Nucleophilic Unimolecular):\n- Kinetics: First-order kinetics (Rate = k * [R-X]). The rate-determining step is carbocation formation.\n- Stereochemistry: Leads to racemization (formation of both retention and inversion products) due to the planar carbocation intermediate which can be attacked from either side.\n\nS_N2 (Substitution Nucleophilic Bimolecular):\n- Kinetics: Second-order kinetics (Rate = k * [R-X] * [Nu\u207b]). The reaction is concerted (single step).\n- Stereochemistry: Complete inversion of configuration (Walden inversion) because the nucleophile attacks from the backside, opposite the leaving group.",
                explanation: 'S_N1 goes through a carbocation intermediate causing racemization, while S_N2 is a single-step back-side attack causing stereochemical inversion.',
                difficulty: 'hard',
                points: 5,
                tags: ['chemistry', 'organic', 'substitution'],
                topicId: topicMap['Organic Mechanisms']?._id,
                skillId: skillMap['Conceptual Understanding']?._id
            },

            // --- BIOLOGY QUESTIONS (Sneha) ---
            {
                tutorId: snehaTutor._id,
                type: 'mcq',
                question: 'Which Mendelian law states that the alleles for a trait separate during gamete formation and randomly unite during fertilization?',
                options: [
                    { text: 'Law of Segregation', isCorrect: true },
                    { text: 'Law of Independent Assortment', isCorrect: false },
                    { text: 'Law of Dominance', isCorrect: false },
                    { text: 'Law of Unit Factors', isCorrect: false }
                ],
                explanation: 'According to the Law of Segregation, the two alleles for a heritable character segregate (separate) during gamete formation and end up in different gametes.',
                difficulty: 'easy',
                points: 2,
                tags: ['biology', 'genetics', 'mendel'],
                topicId: topicMap['Genetics & Inheritance']?._id,
                skillId: skillMap['Conceptual Understanding']?._id
            },
            {
                tutorId: snehaTutor._id,
                type: 'subjective',
                question: 'Explain the physiological steps involved in resting human breathing (both inspiration and expiration).',
                idealAnswer: "Inspiration (Active Process):\n- The diaphragm contracts, moving downwards, and external intercostal muscles contract, lifting the ribs and sternum.\n- This expands the thoracic cavity volume, which decreases intra-pulmonic pressure below atmospheric pressure.\n- Air flows into the lungs to equalize pressure.\n\nExpiration (Passive Process under resting conditions):\n- The diaphragm and external intercostal muscles relax, returning to their natural positions.\n- The thoracic cavity volume decreases, which increases intra-pulmonic pressure above atmospheric pressure.\n- Air is forced out of the lungs.",
                explanation: 'Breathing relies on changing the volume of the thoracic cavity to generate pressure gradients relative to atmospheric pressure.',
                difficulty: 'medium',
                points: 5,
                tags: ['biology', 'physiology', 'breathing'],
                topicId: topicMap['Human Physiology']?._id,
                skillId: skillMap['Observation & Diagram Analysis']?._id
            }
        ];

        for (const q of questionsToSeed) {
            const questionDoc = await Question.findOneAndUpdate(
                { question: q.question, tutorId: q.tutorId },
                { $set: q },
                { upsert: true, new: true }
            );
            console.log(`✅ Seeded ${q.type.toUpperCase()} Question: "${questionDoc.question.substring(0, 40)}..." (ID: ${questionDoc._id})`);
        }

        // ══════════════════════════════════════════════════════════════════════
        //  6. SEED SCHEDULE AVAILABILITY (Vikram & Sneha)
        // ══════════════════════════════════════════════════════════════════════
        console.log('\n📅 Seeding schedule availability for Vikram...');
        const weeklyAvailability = [
            { day: 'Monday', slots: ['09:00-10:00', '10:00-11:00', '14:00-15:00', '15:00-16:00'] },
            { day: 'Tuesday', slots: ['09:00-10:00', '10:00-11:00', '14:00-15:00', '15:00-16:00'] },
            { day: 'Wednesday', slots: ['09:00-10:00', '10:00-11:00', '14:00-15:00', '15:00-16:00'] },
            { day: 'Thursday', slots: ['09:00-10:00', '10:00-11:00', '14:00-15:00', '15:00-16:00'] },
            { day: 'Friday', slots: ['09:00-10:00', '10:00-11:00', '14:00-15:00', '15:00-16:00'] },
            { day: 'Saturday', slots: ['10:00-11:00', '11:00-12:00'] },
            { day: 'Sunday', slots: ['10:00-11:00', '11:00-12:00'] }
        ];

        let scheduleDoc;
        if (vikramTutor.scheduleAppointment) {
            scheduleDoc = await ScheduleAppointment.findByIdAndUpdate(
                vikramTutor.scheduleAppointment,
                { availability: weeklyAvailability },
                { new: true, upsert: true }
            );
        } else {
            scheduleDoc = await ScheduleAppointment.create({
                availability: weeklyAvailability,
                bookingSettings: {
                    minAdvanceHours: 24,
                    maxAdvanceDays: 60,
                    allowSameDayBooking: false,
                    slotCapacity: 1,
                    bufferBetweenSlots: 0
                }
            });
            vikramTutor.scheduleAppointment = scheduleDoc._id;
            await vikramTutor.save();
        }
        console.log(`✅ Seeded schedule availability for Vikram (ID: ${scheduleDoc._id})`);

        let snehaScheduleDoc;
        if (snehaTutor.scheduleAppointment) {
            snehaScheduleDoc = await ScheduleAppointment.findByIdAndUpdate(
                snehaTutor.scheduleAppointment,
                { availability: weeklyAvailability },
                { new: true, upsert: true }
            );
        } else {
            snehaScheduleDoc = await ScheduleAppointment.create({
                availability: weeklyAvailability,
                bookingSettings: {
                    minAdvanceHours: 24,
                    maxAdvanceDays: 60,
                    allowSameDayBooking: false,
                    slotCapacity: 1,
                    bufferBetweenSlots: 0
                }
            });
            snehaTutor.scheduleAppointment = snehaScheduleDoc._id;
            await snehaTutor.save();
        }
        console.log(`✅ Seeded schedule availability for Sneha Iyer (ID: ${snehaScheduleDoc._id})`);

        // ══════════════════════════════════════════════════════════════════════
        //  7. SEED APPOINTMENTS (10 days in the future)
        // ══════════════════════════════════════════════════════════════════════
        console.log('\n🤝 Seeding Appointments (10 days in the future)...');
        const aaravStudent = await User.findOne({ email: 'aarav.patel@gmail.com' });
        const diyaStudent = await User.findOne({ email: 'diya.sharma@gmail.com' });
        const ishaanStudent = await User.findOne({ email: 'ishaan.gupta@gmail.com' });

        const futureAt = (days, hourStr) => {
            const d = new Date();
            d.setDate(d.getDate() + days);
            const [h, m] = hourStr.split(':').map(Number);
            d.setHours(h, m, 0, 0);
            return d;
        };

        const appointmentsToSeed = [
            {
                studentId: aaravStudent?._id,
                tutorId: vikramTutor._id,
                dateTime: futureAt(10, '10:00'),
                duration: 60,
                status: 'confirmed',
                amount: 200,
                notes: 'Discussing Newtonian Mechanics friction and block problems.',
                sessionType: 'online_live'
            },
            {
                studentId: diyaStudent?._id,
                tutorId: vikramTutor._id,
                dateTime: futureAt(10, '14:00'),
                duration: 60,
                status: 'pending',
                amount: 200,
                notes: 'Calculus limit properties doubt solving.',
                sessionType: 'online_live'
            },
            {
                studentId: ishaanStudent?._id,
                tutorId: vikramTutor._id,
                dateTime: futureAt(11, '15:00'),
                duration: 60,
                status: 'confirmed',
                amount: 200,
                notes: 'Carnot cycle and thermodynamics equation derivation.',
                sessionType: 'online_live'
            }
        ];

        for (const app of appointmentsToSeed) {
            if (app.studentId) {
                const searchCriteria = {
                    studentId: app.studentId,
                    tutorId: app.tutorId,
                    dateTime: app.dateTime
                };

                const appDoc = await Appointment.findOneAndUpdate(
                    searchCriteria,
                    {
                        $set: {
                            ...app,
                            meetingLink: `https://meet.jit.si/tutorapp-live-mock-${Math.floor(Math.random() * 1000000)}`
                        }
                    },
                    { upsert: true, new: true }
                );
                console.log(`✅ Seeded Appointment: Student ${appDoc.studentId} with Vikram at ${appDoc.dateTime.toISOString()} (Status: ${appDoc.status})`);
            }
        }

        console.log('\n🎉 Taxonomy, Question Bank, Schedule and Appointments seeding completed successfully!');
    } catch (err) {
        console.error('❌ Error during seeding:', err);
    } finally {
        await mongoose.disconnect();
        console.log('🔄 Disconnected from MongoDB.');
    }
}

run();
