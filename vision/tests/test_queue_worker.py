from cooking_vision.queue_worker import SupabaseOcrQueue


class FakeQueue(SupabaseOcrQueue):
    def __init__(self):
        super().__init__("https://example.supabase.co","server-secret","test-worker")
        self.calls=[]

    def _request(self,path,**kwargs):
        self.calls.append((path,kwargs))
        if kwargs.get("method")=="PATCH":
            return [{"id":"job-1","kind":"receipt","file_count":2,"status":"processing"}]
        return [{"id":"job-1","owner_id":"owner-1","kind":"receipt","file_count":2,"attempt_count":0}]


def test_claim_marks_oldest_queued_job_as_processing():
    queue=FakeQueue()

    job=queue.claim_next()

    assert job["status"]=="processing"
    assert "status=eq.queued" in queue.calls[0][0]
    assert queue.calls[1][1]["body"]["worker_id"]=="test-worker"
    assert queue.calls[1][1]["body"]["attempt_count"]==1


def test_stale_processing_jobs_are_returned_to_the_queue():
    queue=FakeQueue()

    queue.requeue_stale(after_seconds=60)

    path,options=queue.calls[0]
    assert "status=eq.processing" in path
    assert "started_at=lt." in path
    assert options["method"]=="PATCH"
    assert options["body"]["status"]=="queued"
    assert options["body"]["worker_id"] is None
