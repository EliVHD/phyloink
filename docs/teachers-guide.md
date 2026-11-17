# PhyloInk — Teacher's Guide
## Creating Phylogenetic Trees, Illustrations, and Classroom Activities

**A practical guide for biology educators**

PhyloInk is a free, open-source application for exploring, creating, and customizing phylogenetic tree diagrams using scientific source data.

This guide explains how teachers can use PhyloInk to develop their own educational materials, from simple diagrams illustrating common ancestry to interactive activities based on published evolutionary research.

No programming or specialized bioinformatics experience is required to use the visual editor.

**Software:** https://github.com/EliVHD/phyloink

---

## First activity — One tree, two drawings

Start with a teacher-prepared source and a small selection. This example demonstrates an approach you can adapt; it is not part of a required lesson sequence.

1. Open **Datasets** and choose the mammal source.
2. In **Layout**, select five or six terminal taxa suitable for your question.
3. Preview and accept a rectangular cladogram. Save the project.
4. Ask students to identify a common ancestor and a complete clade within the sampled tree.
5. Create a circular view using exactly the same source and selection. Ask students which relationships changed and which merely look different.
6. Export diagrams, retain their sources, and adapt the questions to your learners.

The expected conclusion is that changing the layout alone does not change the supplied topology. Use the labeled diagram as a teacher reference and the unlabeled version as an activity starting point. Review the source and all questions before classroom use.

A finite showcase of prepared projects, example questions, teacher notes and an annotated Newick source directory lives in the [PhyloInk education repository](https://github.com/EliVHD/phyloink-education). Its examples are starting points for educators to adapt, not a full course or a promise of recurring additions. Inheritance and population labs are future planning items; they are not current application features.

### Optional interactive practice

Choose **Learn** above the editor canvas and **Try six mammals** for a short demonstration using the bundled Upham source. Alternatively, choose 2–16 terminal identities from your current rooted phylogenetic source. The activities ask learners to find a most recent common ancestor, identify all displayed descendants of a node, and compare the same relationships in different layouts or after a rotation. Feedback explains the source paths and memberships rather than recording grades.

The sample is incomplete relative to the full source: feedback reports omitted descendants, and a complete source clade includes them. Node numbers are temporary practice markers. Branch spacing is nonmetric, and changing layout does not supply dates or evolutionary distances. Unresolved forks stay unresolved. The six-mammal names are shortened for display only; source identities and original labels remain intact.

Learn requires a declared phylogenetic basis, known tip entities and a biological root; a serialization origin or classification hierarchy does not establish ancestors. For gene/sequence trees, the ancestry concerns those entities and does not establish species ancestry. Review source limitations before adapting a question.

Practice is temporary. Returning to the editor discards the workspace while retaining the saved drawing, pins, selection and undo history. To reuse a setup, open **Local activity scenarios**, enter a title, introduction and educator notes, and use **Adapt / keep this question → Keep question** for each question. **Save scenario** downloads a self-contained local activity file; **Open scenario** restores its source, sample and question setups. Choose a kept question to reset answers and begin it. Notes are visible to anyone opening the file. Saved learner answers and progress are not part of the format.

A scenario includes the complete Newick source and its citations, so review reuse terms before sharing it. A changed sample clears kept questions that may no longer apply. Keep an edited question before saving; if none are kept, Save records the current setup. Use editor exports for printable artwork. The usage guide explains the workflow, and the education repository provides two independent, adaptable demonstrations. Learn is not a promised sequence of lessons.

---

## 1. What Can You Create with PhyloInk?

PhyloInk can support several approaches to teaching evolution, taxonomy, and phylogenetic reasoning.

### Explanatory diagrams

Create clear phylogenetic diagrams for presentations, handouts, textbooks, and other teaching resources.

Examples include:

- A simplified tree illustrating relationships among selected mammals.
- A cladogram introducing common ancestry and branching evolution.
- A diagram showing major groups within a larger evolutionary lineage.
- Different graphical representations of the same phylogenetic relationships.

### Student worksheets

Prepare diagrams that students can examine, label, annotate, or interpret.

PhyloInk can export both labeled and unlabeled versions of the same tree. Teachers can use these as the starting point for exercises asking students to identify taxa, branching points, clades, or common ancestors.

### Interactive exploration activities

Instead of presenting a finished diagram, let students investigate a larger scientific tree themselves.

Students can search for organisms, navigate evolutionary groups, and explore branching relationships using the dedicated Explore view.

### Inquiry-based lessons

Create activities where students formulate questions, investigate phylogenetic relationships, and explain their conclusions using evidence from a scientific source.

### Scientific illustrations

Produce customized diagrams based on published phylogenetic data, with references and source information preserved alongside the exported materials.

---

## 2. Before You Begin

### Technical requirements

PhyloInk operates locally in a web browser.

It does not require an account, cloud storage, or uploading data to an external service. Once installed, it can be used offline.

For the simplest distribution, use the prebuilt browser release:

1. Download the browser release archive from the project repository.
2. Extract the files to a local folder.
3. Serve the extracted folder using a local HTTP server.
4. Open the application in a browser.

For example, if Python 3 is installed, a local server can be started from the extracted directory using:

`python3 -m http.server 4173 --bind 127.0.0.1`

On Windows, use `py -3 -m http.server 4173 --bind 127.0.0.1` if Python is installed through the Python launcher.

Then open `http://127.0.0.1:4173`.

Opening the HTML file directly without a local HTTP server is not supported.

The repository README provides alternative installation instructions using Node.js.

### Choosing a classroom setup

**Teacher-led demonstration:** Run PhyloInk on one computer and project the screen. This is suitable for introducing tree interpretation or exploring larger datasets together.

**Individual student activity:** Install or make the application available on each student's computer. Students can independently examine trees and save their work.

**Prepared-project activity:** Create and save a PhyloInk project in advance. Students can load the project and begin from an existing tree and selection rather than navigating a large dataset independently.

**Important:** PhyloInk does not provide persistent autosave or online collaboration. Projects must be saved manually and shared as files.

---

## 3. Start with a Scientific Question

Before creating a diagram, define what students should learn from it.

A useful teaching diagram should answer a specific question rather than simply display as many organisms as possible.

For example:

| Learning objective | Suitable diagram |
|---|---|
| Introduce common ancestry | Small, rooted cladogram with 4–6 terminal taxa |
| Explain clades | Tree showing several nested evolutionary groups |
| Compare evolutionary relationships | Tree containing 5–8 selected organisms |
| Demonstrate different tree layouts | The same topology in rectangular and circular form |
| Explore biological diversity | Larger tree with identifiable groups and subgroups |
| Teach scientific interpretation | Tree accompanied by its source and methodological limitations |

For introductory lessons, a small selection of organisms is generally easier to interpret than a complete scientific tree.

The complete tree can still be explored separately to demonstrate the broader evolutionary context.

---

## 4. Choose an Appropriate Scientific Dataset

PhyloInk includes several datasets derived from scientific research.

| Dataset | Suggested educational applications |
|---|---|
| **Tree of Life — Hug et al. (2016)** | Broad evolutionary relationships and the diversity of life |
| **Mammals — Upham et al. (2019)** | Mammalian evolution, common ancestry, nested clades |
| **Primates — dos Reis et al. (2018)** | Primate evolutionary relationships and interpreting branching patterns |
| **Plants — Kew (2026)** | Plant diversity, major plant lineages, and relationships among sampled taxa |

### Using a bundled dataset

1. Open **Datasets** in the application header.
2. Select the scientific source appropriate for the lesson.
3. Review the available scientific basis and source information.
4. Switch to **Explore** to investigate the full tree.

Each dataset contains its own documented source information and limitations.

### Importing your own tree

Teachers can also import externally obtained phylogenetic trees using the Newick format.

Supported extensions include `.nwk`, `.newick`, `.tree`, and `.txt`.

Use **Open file** to load a suitable tree.

After importing, use **Scientific basis · Edit** to record the source, meaning of the relationships, and any necessary information about rooting or branch distances.

**Scientific integrity:** PhyloInk does not reconstruct evolutionary relationships from DNA sequences, morphological measurements, or other raw biological evidence. It visualizes relationships already supplied by the source data.

Teachers should therefore select published, appropriately documented sources for activities involving real organisms.

---

## 5. Explore the Tree Before Creating a Diagram

The Explore view is particularly useful for identifying suitable organisms and understanding how they fit into a broader evolutionary context.

### Step-by-step exploration

1. Load a scientific dataset.
2. Select **Explore** above the editor canvas.
3. Search for an organism or named group.
4. Zoom and pan to inspect the surrounding branches.
5. Select a branching point or group to inspect its source information.
6. Follow the connections to related organisms.
7. Identify a group suitable for the intended lesson.

Large datasets are displayed with automatically collapsed groups to maintain usability. These groups can be explored in more detail without changing the underlying scientific source.

### Questions to consider

Before choosing organisms for an illustration, determine:

- Are the relationships clearly represented in the source?
- Does the selected group illustrate the intended concept?
- Is the tree rooted, and is that rooting scientifically supported?
- Does the selection contain unresolved relationships?
- Will students need additional background knowledge to interpret the diagram?

Avoid selecting organisms simply because their resulting arrangement is visually convenient.

**Teaching opportunity:** Use the exploration process itself to demonstrate that a familiar group of organisms represents only a small part of a much larger evolutionary tree.

---

## 6. Create Your Own Phylogenetic Diagram

Once a suitable group has been identified, create a smaller diagram for classroom use.

### Step 1 — Select organisms

Return to the editor using **← Editor**.

Within **Layout**, search for the organisms to include and add their source identities to the selection. Where supported, a selected clade can also provide its source tips as a group.

For introductory classroom diagrams, begin with approximately 5–8 terminal taxa.

### Step 2 — Choose a visualization

PhyloInk supports several layouts.

**Rectangular cladogram**

Recommended for introducing phylogenetic concepts. The layout makes nested groups and branching relationships comparatively easy to follow.

**Circular cladogram**

Suitable for illustrating larger groups and demonstrating that the same evolutionary relationships can have different visual arrangements.

**Fan-shaped cladogram**

Useful for comparing several lineages within a compact diagram.

**Unrooted tree**

Suitable for more advanced discussions about relationships when a root direction has not been established.

**Phylogram**

Suitable when students need to interpret documented branch-distance information. Requires the appropriate scientific basis, units, and scale.

**Classification hierarchy**

Suitable for explaining supplied taxonomic memberships and ranks. A classification hierarchy should not automatically be presented as an inferred evolutionary tree.

### Step 3 — Configure the diagram

Within Layout:

1. Choose the selected source tips.
2. Name the view.
3. Set the page dimensions.
4. Adjust text size, line appearance, and spacing.
5. Select the appropriate tree layout.
6. Choose **Preview layout**.
7. Inspect the result and select **Use layout** to accept it.

The selected layout should match the scientific information you intend to communicate.

For example, do not imply that branch lengths represent millions of years unless the dataset and chosen visualization support that interpretation.

### Step 4 — Improve readability

A diagram intended for education must be readable without requiring students to guess what a branch or label represents.

Check that:

- Organism names remain legible.
- Branching points can be distinguished.
- Labels do not overlap.
- Important groups are not visually obscured.
- The diagram fits the intended page or presentation format.

PhyloInk includes a **Preview readability** function for cladograms, allowing teachers to inspect proposed improvements before accepting them.

Individual labels and junctions can also be adjusted. Geometry can be pinned where necessary.

A separate artistic copy provides greater freedom for manual arrangement, but its geometry does not represent calibrated evolutionary distances.

### Step 5 — Save and export

Use **Save project** to preserve the editable PhyloInk project.

Use **Export package** to obtain:

- Labeled and unlabeled SVG versions of the accepted diagram.
- The editable project.
- Source-tree information and mappings.
- References and Sources & Methods records.
- Geometry and coverage check results.

SVG files can be incorporated into presentations, worksheets, and documents without the quality loss associated with enlarging raster images.

**Remember:** A successful geometry check confirms only the implemented layout and coverage conditions. It does not independently verify the biological correctness of the source data.

---

## 7. Turn a Diagram into a Teaching Activity

A phylogenetic diagram becomes a stronger educational resource when students must actively interpret it.

The following activity formats can be adapted to different age groups and learning objectives.

### Activity A — Identify the Common Ancestor

**Concept:** Common ancestry and evolutionary relatedness

**Recommended level:** Introductory

**Preparation:** Create a rooted cladogram containing approximately 5–6 organisms.

**Student tasks:**

1. Identify two selected terminal taxa.
2. Trace their branches toward the root.
3. Locate their most recent common ancestor.
4. Repeat the process with another pair of taxa.
5. Determine which pair shares the more recent common ancestor.

**Key teaching point:** Evolutionary relatedness is determined by shared ancestry, not by how close names appear on the page.

### Activity B — Discover the Clades

**Concept:** Monophyletic groups and nested evolutionary relationships

**Recommended level:** Intermediate

**Preparation:** Select a group containing several recognizable nested clades.

**Student tasks:**

1. Identify a branching point.
2. Trace all descendant branches represented in the tree.
3. Identify the clade formed by those descendants.
4. Locate a larger clade that contains the first.
5. Explain why a proposed grouping that excludes some descendants would not represent the complete clade.

**Key teaching point:** A clade includes a common ancestor and all of its descendants, within the scope of the represented tree.

### Activity C — One Tree, Different Shapes

**Concept:** Tree topology and graphical representation

**Recommended level:** Introductory to intermediate

**Preparation:** Create rectangular and circular cladograms from the same selected source and terminal taxa.

**Student tasks:**

1. Compare the two diagrams.
2. Identify the same groups in both.
3. Determine whether any evolutionary relationships have changed.
4. Explain why organisms appearing next to one another are not necessarily closely related.

**Key teaching point:** Visual arrangement and evolutionary relationships are different concepts.

### Activity D — Investigate an Evolutionary Group

**Concept:** Inquiry-based scientific investigation

**Recommended level:** Intermediate to advanced

**Preparation:** Select an appropriate scientific dataset and give students access to PhyloInk.

**Student tasks:**

1. Choose a group of organisms.
2. Explore their positions within the larger scientific tree.
3. Identify a smaller group for closer investigation.
4. Create a diagram representing their relationships.
5. Explain at least two relationships using common ancestry.
6. Record the scientific source and one limitation of the resulting interpretation.

**Key teaching point:** Phylogenetic trees are scientific models based on available evidence and subject to revision.

---

## 8. Prepare Student and Teacher Versions

One useful application of PhyloInk is creating different teaching materials from the same scientific tree.

### Teacher reference

Export the labeled version of the diagram.

Use this as an instructor reference, explanatory illustration, or projected diagram.

Annotate relevant branching points or clades in your presentation or document editor if additional emphasis is needed.

### Student worksheet

Export the unlabeled version.

Use it as the foundation for a worksheet in which students must identify organisms, groups, or branching relationships.

Depending on the exercise, add numbered terminal positions, a word bank, or task instructions using a document or vector graphics editor.

### Independent investigation

Distribute the saved `.treeproject.json` file and allow students to open it within PhyloInk.

Students can inspect the source, examine relationships, and create their own diagram views.

### Why keep both versions?

A shared underlying source helps ensure that a worksheet, instructor reference, and student project describe the same scientific relationships.

Keep the editable project and source documentation alongside the exported diagrams so that materials can be revised later.

---

## 9. Build a Complete Lesson

A useful lesson usually contains more than a diagram and a list of questions.

The following sequence provides a reusable framework.

### Example: Understanding Evolutionary Relationships

**Audience:** Upper secondary biology or introductory university biology

**Duration:** 60 minutes for the full sequence below

**Learning goal:** Students will use a phylogenetic tree to identify common ancestors, recognize clades, and explain evolutionary relationships.

| Stage | Duration | Activity |
|---|---|---|
| Introduction | 5 min | Present a simple tree and ask students to interpret its branches |
| Guided explanation | 10 min | Explain terminal taxa, nodes, clades, and common ancestry |
| Investigation | 15 min | Students explore a real scientific dataset in PhyloInk |
| Application | 15 min | Students interpret or create a smaller phylogenetic diagram |
| Discussion | 10 min | Compare findings and address common misconceptions |
| Assessment | 5 min | Students answer a short question requiring evidence from the tree |

### Example assessment question

*A phylogenetic tree shows organisms A and B sharing a more recent common ancestor with each other than either shares with organism C. Explain why A and B are considered more closely related, even if A appears visually closer to C in the diagram.*

**Expected answer:** A and B share a more recent common ancestor. The apparent distance between their labels does not determine their evolutionary relatedness.

### Adapting the lesson

**For younger students:** Use fewer organisms, larger labels, and primarily rectangular cladograms. Concentrate on identifying branches and shared ancestors.

**For older students:** Introduce nested clades, alternative layouts, unresolved relationships, and the distinction between cladograms and phylograms.

**For advanced students:** Discuss phylogenetic inference, rooting, uncertainty, source sampling, and the differences between alternative scientific hypotheses. These concepts may require additional datasets and external teaching resources.

---

## 10. Maintain Scientific Accuracy

Phylogenetic trees can easily be misunderstood, especially when simplified for teaching.

The following principles should guide the preparation of educational diagrams.

### Avoid implying evolutionary progress

A phylogenetic tree does not represent a ladder from primitive to advanced organisms.

The position of a taxon at the top, bottom, left, or right of a diagram does not imply superiority or greater evolutionary advancement.

### Distinguish topology from distance

A cladogram communicates branching relationships.

Unless explicitly supported by the source and visualization, its branch lengths should not be interpreted as evolutionary time, genetic distance, or the amount of evolutionary change.

### Be careful with rooting

Interpretations involving ancestors and descendants depend on the direction of rooting.

For unrooted trees, do not assign ancestral direction merely from the layout.

### Preserve scientific uncertainty

Some trees contain unresolved relationships, incomplete sampling, or disputed groupings.

Do not present visually simplified diagrams as more certain than their underlying evidence allows.

Unresolved branching structures should not be arbitrarily resolved for visual convenience.

### Identify the source

Educational diagrams should include or accompany:

- The original scientific source or dataset.
- The authors and publication or release year.
- Relevant modifications or selections made for the lesson.
- Any limitations needed for correct interpretation.

PhyloInk can retain this information through its scientific basis and export records.

### Explain what the software does not do

PhyloInk is a visualization and editing tool, not a phylogenetic inference system.

It does not analyze DNA sequences, estimate ancestral relationships, infer divergence dates, or independently establish the correctness of imported data.

These limitations can form part of valuable discussions about how scientific knowledge is produced.

---

## 11. Make Materials Accessible

An effective educational illustration should work for a broad range of students and classroom conditions.

**Readable typography:** Choose label sizes appropriate for the final viewing medium. A diagram that is legible on a desktop monitor may be difficult to read when printed on a worksheet.

**Clear branching structure:** Avoid unnecessary crossings, overlapping branches, or excessively compressed layouts.

**Color-independent interpretation:** Do not depend on color alone to identify related groups. Use labels, annotations, or other visual distinctions.

**Appropriate complexity:** Begin with smaller diagrams and introduce greater diversity as students become comfortable interpreting tree structures.

**Alternative descriptions:** When distributing diagrams digitally, include a brief text explanation describing the main evolutionary relationships or learning objective.

**Consistent representations:** When comparing different layouts, use the same selection of taxa and underlying source relationships.

**Printable resources:** Use vector SVG exports to preserve diagram quality. Review the resulting document at the intended print size.

---

## 12. Save, Share, and Reuse Your Resources

PhyloInk supports local, file-based workflows.

Teachers can preserve source-aware editable projects and distribute exported diagrams as part of their own educational materials.

### Recommended resource package

For a reusable classroom activity, keep together:

1. **Lesson plan** — Objectives, prerequisites, estimated time, and activity sequence.
2. **Student worksheet** — Questions, tasks, and diagrams.
3. **Teacher reference** — Labeled diagrams and expected answers.
4. **PhyloInk project** — The editable project used to prepare the materials.
5. **Source information** — References, scientific context, and dataset licensing information.

The worksheet and lesson-plan documents are prepared separately; PhyloInk exports diagrams and supporting scientific records rather than generating complete educational lessons automatically.

### Licensing and attribution

PhyloInk's original software is licensed under 0BSD.

Its bundled scientific datasets retain their own licenses, including CC0 and CC BY 4.0 material.

When sharing teaching resources, preserve any attribution and licensing information required for the underlying datasets and other incorporated materials.

Teachers may select an appropriate open educational resource license for their own original lesson materials.

---

## 13. Teacher's Planning Checklist

Before distributing a lesson, verify the following:

**Scientific content**

- [ ] The chosen dataset is appropriate for the lesson.
- [ ] The original source is documented.
- [ ] The displayed relationships support the intended learning objective.
- [ ] Rooting, branch lengths, and unresolved relationships are interpreted correctly.

**Diagram preparation**

- [ ] The selection contains a manageable number of organisms.
- [ ] Labels and branches are readable.
- [ ] The layout does not imply unsupported evolutionary information.
- [ ] The diagram has been visually inspected.
- [ ] The editable project has been saved.

**Educational design**

- [ ] Learning objectives are explicit.
- [ ] Students must interpret evidence rather than merely recognize names.
- [ ] Instructions match the students' prior knowledge.
- [ ] Expected answers have been checked against the scientific source.
- [ ] Common misconceptions are addressed.

**Distribution**

- [ ] Student-facing resources are ready.
- [ ] Teacher reference materials are available.
- [ ] Source citations and required attribution are included.
- [ ] Students have the necessary software access or prepared diagrams.

---

## 14. Further Resources

**PhyloInk repository and installation instructions**

https://github.com/EliVHD/phyloink

**Built-in application guide**

The application includes a technical guide covering importing data, searching, exploring, layout creation, manual editing, saving, and exporting.

It is available through **Guides** in the application header. The [offline usage guide](/guide.html) explains the controls; the Teacher's Guide explains classroom preparation.

**Scientific references**

The application's bundled sources include published phylogenetic research and supporting documentation. Detailed references and licensing information are available through the application's source records and repository.

**Version note**

This guide describes the PhyloInk 0.1.2-dev.0 development build, formerly Clade Studio. The software is a maintenance prerelease, is not actively maintained, and may produce layouts requiring manual review or correction. It is best used with teacher-prepared datasets and projects that have been checked before classroom use.

---

**PhyloInk — Explore evolutionary relationships. Create scientifically grounded diagrams. Teach through discovery.**
