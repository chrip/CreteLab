<template>
  <article class="page about" lang="en">
    <!-- English only, in both language versions of the site. -->
    <h1>About CreteLab</h1>
    <p class="lead">
      CreteLab turns a sentence like "driveway, 6 x 3 m, 15 cm thick, salted in winter" into a concrete recipe you can
      mix, buy or order. It started as a browser calculator for the German mix-design leaflet Zement-Merkblatt B 20.
      Today it is an open-source project with a custom-trained language model.
    </p>

    <h2>How a description becomes a recipe</h2>
    <ol>
      <li>
        A fine-tuned <a :href="LAYA" rel="noopener">Laya</a> model (mmBERT-base,
        322 M parameters) reads the text and answers 16 typed questions about it. Does it freeze? Is there de-icing
        salt? Is it reinforced? What shape is it? For every number in the text it answers one more question: is 2 cm
        the wall, the thickness or something else? The model never writes free text, so it cannot make up a recipe.
      </li>
      <li>
        Plain code does the engineering. DIN 1045-2 rules turn the answers into exposure classes, geometry formulas
        turn shape and sizes into cubic metres, and the mix design calculates the recipe. All of this runs in your
        browser and is covered by tests.
      </li>
      <li>
        You get three ways to make it: a bagged product whose datasheet covers the requirements (or the reason none
        does), a recipe to mix yourself, and an order text for a ready-mix plant.
      </li>
    </ol>
    <p>
      I split the work this way on purpose. A language model is good at reading "the driveway gets salted" as
      "de-icing salt: yes". I would not let it decide the cement content, because rules and formulas can be checked
      line by line and a model's weights cannot.
    </p>

    <h2>Training the model</h2>
    <div class="table-wrap">
      <table class="facts">
        <tbody>
          <tr v-for="[label, value] in TRAINING" :key="label">
            <th scope="row">{{ label }}</th>
            <td>{{ value }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <p>
      The teacher wrote the descriptions the way people type into a search box, typos and missing details included,
      and then voted several times on every question. The share of votes became a soft target, so the model learns how
      sure it should be along with the answer itself.
    </p>
    <p>
      The repository contains the <a :href="`${repository}/tree/main/ml`" rel="noopener">training data</a> and leaves
      out the weights. Rebuilding the model from the data takes about an hour on a GPU, while creating the teacher data
      set took most of the effort.
    </p>

    <h2>How the model learns</h2>
    <p>
      <a :href="LAYA" rel="noopener">Laya</a> is a decision model. An encoder reads the description together with one question and its
      options, and a small decision head scores all options in a single forward pass; nothing is generated word by word. The answer is a
      probability for each option, so a planter that "stands outside" can be 90 % frost and still show that it is not
      certain.
    </p>
    <p>
      <a :href="LAYA" rel="noopener">Laya</a> trains these probabilities with Reinforcement Learning for Calibrated Decisions (RLCD):
      reinforcement learning against strictly proper scoring rules. For every question the training draws several slightly perturbed versions of the model's answer,
      rewards each one with a proper scoring rule (log score and spherical score, plus the ranked probability score for
      ordered levels such as traffic) and moves the model towards the versions that scored above the group average.
      A proper scoring rule is maximised only by reporting the true probabilities, so the model earns the most when its
      confidence matches the evidence. The fine-tuning for CreteLab adds a cross-entropy term on the teacher's
      vote shares and, at the end, fits one temperature per question type on a held-out tenth of the data to calibrate
      the confidences.
    </p>

    <h2>Checking the engineering</h2>
    <p>
      The engineering follows the German concrete standards rather than rules of thumb. The strength a concrete reaches
      at a given water-cement ratio comes from the Walz curves, digitised from the original charts and fitted to within
      1 N/mm². The limits of the industry standards are implemented with the mathematics behind them: exposure
      classes, the absolute volume method, the equivalent water-cement ratio of additions and the effect of entrained
      air. Every recipe is checked against these rules, and published worked examples run as regression tests.
    </p>
    <p>
      The advice on bagged concrete comes from twelve manufacturer datasheets; they say, for example, that nothing but
      water may be added to a bag. Every fine-concrete recipe cites its source and is tested against the quoted amounts.
    </p>

    <h2>Open source</h2>
    <p>
      CreteLab is MIT-licensed and on <a :href="repository" rel="noopener">GitHub</a>, training data included. It
      builds on open projects:
    </p>
    <ul>
      <li><a :href="LAYA" rel="noopener">Laya</a> by Convai Innovations (Apache 2.0), the decision model.</li>
      <li><a href="https://huggingface.co/jhu-clsp/mmBERT-base" rel="noopener">mmBERT</a>, the multilingual encoder inside it.</li>
      <li><a href="https://huggingface.co/unsloth/Qwen3.8-27B-NVFP4" rel="noopener">Qwen3.8-27B</a> (Apache 2.0), the teacher, served with <a href="https://github.com/vllm-project/vllm" rel="noopener">vLLM</a>.</li>
      <li><a href="https://pytorch.org" rel="noopener">PyTorch</a> for training, <a href="https://fastapi.tiangolo.com" rel="noopener">FastAPI</a> for the API.</li>
      <li><a href="https://nuxt.com" rel="noopener">Nuxt</a> and <a href="https://vuejs.org" rel="noopener">Vue</a> for the website.</li>
    </ul>
    <p>
      <a href="https://github.com/chrip" rel="noopener">Christoph Schaefer</a>, a software developer, builds CreteLab as a
      side project. For load-bearing parts, ask a
      structural engineer.
    </p>
  </article>
</template>

<script setup lang="ts">
const { repository } = useRuntimeConfig().public;
const LAYA = 'https://github.com/NandhaKishorM/laya';

const TRAINING: [string, string][] = [
  ['Teacher model', 'Qwen3.8-27B (NVFP4), served locally with vLLM'],
  ['Hardware', 'NVIDIA DGX Spark, 128 GB unified memory'],
  ['Training data', '4,349 descriptions (2,899 German, 1,450 English, 145 topics), 22,409 teacher votes'],
  ['Labelling runs', 'about 24 hours in several runs, 8 requests in parallel, about 150 to 170 tokens/s'],
  ['Tokens', 'about 3.5 M prompt and 11.8 M generated tokens'],
  ['Same runs in the cloud', 'about $110 to $250 with Claude Opus 5.5, $55 to $125 with the batch API'],
  ['Fine-tuning', "65,032 training items, 60 minutes on the Spark's GPU (a day or more on a laptop CPU)"],
  ['Inference', '20 to 60 ms per description on the GPU, about 2 s on the CPU of the Docker image'],
];

useSeoMeta({
  title: 'About',
  description: 'How CreteLab works: a Laya model trained locally on a DGX Spark, a tested mix design, Nuxt and FastAPI.',
});
</script>

<style scoped>
.about {
  max-width: 48rem;
}

.about h2 {
  margin-top: 2rem;
}

.about li + li {
  margin-top: 0.5rem;
}

.facts th {
  text-transform: none;
  letter-spacing: 0;
  font-size: 0.9rem;
  white-space: nowrap;
  width: 12rem;
}
</style>
