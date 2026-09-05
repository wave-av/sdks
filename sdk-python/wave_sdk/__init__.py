"""
WAVE SDK for Python

Official Python SDK for the WAVE API by WAVE Inc.

Example:
    >>> from wave_sdk import Wave
    >>> client = Wave(api_key="your-api-key")
    >>> streams = client.pipeline.list()
    >>> clips = client.clips.list()
"""

from wave_sdk.client import WaveClient, WaveError, RateLimitError

# Existing P3 modules
from wave_sdk.clips import ClipsAPI
from wave_sdk.editor import EditorAPI
from wave_sdk.voice import VoiceAPI
from wave_sdk.phone import PhoneAPI
from wave_sdk.collab import CollabAPI
from wave_sdk.captions import CaptionsAPI
from wave_sdk.chapters import ChaptersAPI
from wave_sdk.studio_ai import StudioAIAPI
from wave_sdk.transcribe import TranscribeAPI
from wave_sdk.sentiment import SentimentAPI
from wave_sdk.search import SearchAPI
from wave_sdk.scene import SceneAPI

# P1 modules
from wave_sdk.pipeline import PipelineAPI
from wave_sdk.studio import StudioAPI

# P2 modules
from wave_sdk.fleet import FleetAPI
from wave_sdk.ghost import GhostAPI
from wave_sdk.mesh import MeshAPI
from wave_sdk.edge import EdgeAPI
from wave_sdk.pulse import PulseAPI
from wave_sdk.prism import PrismAPI
from wave_sdk.zoom import ZoomAPI

# P3 new modules
from wave_sdk.vault import VaultAPI
from wave_sdk.marketplace import MarketplaceAPI
from wave_sdk.connect import ConnectAPI
from wave_sdk.distribution import DistributionAPI
from wave_sdk.desktop import DesktopAPI
from wave_sdk.signage import SignageAPI
from wave_sdk.qr import QrAPI
from wave_sdk.audience import AudienceAPI
from wave_sdk.creator import CreatorAPI

# P4 modules
from wave_sdk.podcast import PodcastAPI
from wave_sdk.slides import SlidesAPI
from wave_sdk.usb import UsbAPI

# Cross-cutting
from wave_sdk.notifications import NotificationsAPI
from wave_sdk.drm import DrmAPI

__version__ = "3.0.0"
__all__ = [
    "Wave",
    "WaveClient",
    "WaveError",
    "RateLimitError",
    # Existing P3
    "ClipsAPI", "EditorAPI", "VoiceAPI", "PhoneAPI", "CollabAPI",
    "CaptionsAPI", "ChaptersAPI", "StudioAIAPI", "TranscribeAPI",
    "SentimentAPI", "SearchAPI", "SceneAPI",
    # P1
    "PipelineAPI", "StudioAPI",
    # P2
    "FleetAPI", "GhostAPI", "MeshAPI", "EdgeAPI", "PulseAPI",
    "PrismAPI", "ZoomAPI",
    # P3 new
    "VaultAPI", "MarketplaceAPI", "ConnectAPI", "DistributionAPI",
    "DesktopAPI", "SignageAPI", "QrAPI", "AudienceAPI", "CreatorAPI",
    # P4
    "PodcastAPI", "SlidesAPI", "UsbAPI",
    # Cross-cutting
    "NotificationsAPI", "DrmAPI",
]


class Wave:
    """
    Full WAVE SDK client with all APIs attached.

    Example:
        >>> from wave_sdk import Wave
        >>> wave = Wave(api_key="your-api-key", organization_id="org_123")
        >>> streams = wave.pipeline.list()
        >>> clips = wave.clips.list()
        >>> wave.prism.discover_sources()
    """

    def __init__(
        self,
        api_key: str,
        organization_id: str | None = None,
        base_url: str = "https://api.wave.online",
        timeout: float = 30.0,
        max_retries: int = 3,
        debug: bool = False,
    ):
        self.client = WaveClient(
            api_key=api_key,
            organization_id=organization_id,
            base_url=base_url,
            timeout=timeout,
            max_retries=max_retries,
            debug=debug,
        )

        # Existing P3
        self.clips = ClipsAPI(self.client)
        self.editor = EditorAPI(self.client)
        self.voice = VoiceAPI(self.client)
        self.phone = PhoneAPI(self.client)
        self.collab = CollabAPI(self.client)
        self.captions = CaptionsAPI(self.client)
        self.chapters = ChaptersAPI(self.client)
        self.studio_ai = StudioAIAPI(self.client)
        self.transcribe = TranscribeAPI(self.client)
        self.sentiment = SentimentAPI(self.client)
        self.search = SearchAPI(self.client)
        self.scene = SceneAPI(self.client)

        # P1 - Core
        self.pipeline = PipelineAPI(self.client)
        self.studio = StudioAPI(self.client)

        # P2 - Enterprise
        self.fleet = FleetAPI(self.client)
        self.ghost = GhostAPI(self.client)
        self.mesh = MeshAPI(self.client)
        self.edge = EdgeAPI(self.client)
        self.pulse = PulseAPI(self.client)
        self.prism = PrismAPI(self.client)
        self.zoom = ZoomAPI(self.client)

        # P3 - Content & Commerce
        self.vault = VaultAPI(self.client)
        self.marketplace = MarketplaceAPI(self.client)
        self.connect = ConnectAPI(self.client)
        self.distribution = DistributionAPI(self.client)
        self.desktop = DesktopAPI(self.client)
        self.signage = SignageAPI(self.client)
        self.qr = QrAPI(self.client)
        self.audience = AudienceAPI(self.client)
        self.creator = CreatorAPI(self.client)

        # P4 - Specialized
        self.podcast = PodcastAPI(self.client)
        self.slides = SlidesAPI(self.client)
        self.usb = UsbAPI(self.client)

        # Cross-cutting
        self.notifications = NotificationsAPI(self.client)
        self.drm = DrmAPI(self.client)
