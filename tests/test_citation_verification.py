from research_agent.agent import ResearchAgent, Source
from research_agent.config import Config


class CitedSourceIsolationFakeLLM:
    def __init__(self):
        self.prompts = []

    def generate_json(self, prompt, model, **kwargs):
        self.prompts.append(prompt)
        return {
            "results": [
                {
                    "id": 1,
                    "label": "unsupported",
                    "reason": "The cited passage does not support the claim",
                    "facts": [
                        {
                            "fact": "The widget has a 40 percent larger display",
                            "supported": False,
                            "source": 1,
                            "quote": "",
                        }
                    ],
                }
            ]
        }


def test_verify_sends_only_the_passages_for_the_cited_source():
    llm = CitedSourceIsolationFakeLLM()
    agent = ResearchAgent(llm, searcher=None, config=Config())
    cited_passage = "The cited source states that the widget weighs 120 grams."
    other_passage = "A different source states that the widget has a 40 percent larger display."
    sources = [
        Source(
            id=1,
            title="Source A",
            url="https://example.com/source-a",
            passages=[cited_passage],
        ),
        Source(
            id=2,
            title="Source B",
            url="https://example.com/source-b",
            passages=[other_passage],
        ),
    ]

    claims = agent.verify(
        "The widget has a 40 percent larger display [1].",
        sources,
    )

    assert len(llm.prompts) == 1
    verification_prompt = llm.prompts[0]
    assert cited_passage in verification_prompt
    assert other_passage not in verification_prompt

    assert len(claims) == 1
    assert claims[0].cites == [1]
    assert claims[0].label == "unsupported"
    assert claims[0].facts == [
        {
            "fact": "The widget has a 40 percent larger display",
            "supported": False,
            "source": 1,
            "quote": "",
        }
    ]
